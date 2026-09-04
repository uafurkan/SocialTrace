import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Profile, SnapshotSummary, SocialUser } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";
import { provider } from "@/lib/providers";
import { collectPages } from "@/lib/providers/collect";

/**
 * Spec §19's snapshot lifecycle (REQUESTED -> QUEUED -> COLLECTING ->
 * NORMALIZING -> VALIDATING -> INDEXING -> COMPLETED) assumes a job queue.
 * This build has none (see docs/KNOWN_LIMITATIONS.md), so a "snapshot" here
 * is captured synchronously, in one request, the same honest-scope
 * reduction as the export system (docs/EXPORT.md). Follower/following
 * membership capture is bounded for the same cost/latency reasons as
 * export and the Apify provider's own MEMBER_FETCH_CAP.
 */
export const SNAPSHOT_MEMBER_LIMIT = 500;
const PAGE_SIZE = 100;

/**
 * Spec §20's mandatory rule: a partial/capped capture must never be used to
 * infer mass "removal" (or "addition") — a member missing from this
 * snapshot's capped sample might just be outside the cap, not actually
 * gone. Membership diffing (see diffMemberships below) only runs when a
 * kind's coverage is at least this complete on both sides of the
 * comparison; otherwise no added/removed change_events are recorded for
 * that kind at all, which is the honest "comparison unavailable" outcome.
 */
const DIFF_COVERAGE_THRESHOLD = 99.5;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * The snapshot's own coverage — indexed (what this snapshot actually
 * persisted, bounded by SNAPSHOT_MEMBER_LIMIT) over total (the profile's
 * real count) — not the provider's separate coverage claim. A provider
 * can honestly report 100% coverage (it could serve the whole list) while
 * this snapshot only stored a capped sample of it; showing the provider's
 * number here would misrepresent what's actually in the database.
 */
function coveragePercentFor(indexed: number, total: number): number {
  if (total <= 0) return 0;
  const raw = (indexed / total) * 100;
  return raw < 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10) / 10;
}

function toSnapshotSummary(row: typeof schema.profileSnapshots.$inferSelect): SnapshotSummary {
  return {
    id: row.id,
    capturedAt: row.capturedAt.toISOString(),
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
    indexedFollowerCount: row.indexedFollowerCount,
    indexedFollowingCount: row.indexedFollowingCount,
    followerCoveragePercent: Number(row.followerCoveragePercent),
    followingCoveragePercent: Number(row.followingCoveragePercent),
  };
}

async function upsertProfileRow(db: ReturnType<typeof getDb>, profile: Profile) {
  const values = {
    platform: profile.platform,
    username: profile.username,
    normalizedUsername: normalizeUsername(profile.username),
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified,
    isPrivate: profile.isPrivate,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    postCount: profile.postCount,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(schema.profiles)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.profiles.platform, schema.profiles.normalizedUsername],
      set: values,
    })
    .returning();
  return row;
}

/** Upserts by (platform, normalized_username) in one batched statement so N followers costs one HTTP round trip, not N. */
async function upsertSocialUsers(
  db: ReturnType<typeof getDb>,
  platform: Profile["platform"],
  users: SocialUser[],
): Promise<Map<string, string>> {
  if (users.length === 0) return new Map();

  const deduped = new Map<string, SocialUser>();
  for (const user of users) deduped.set(normalizeUsername(user.username), user);

  const valuesList = [...deduped.entries()].map(([normalizedUsername, user]) => ({
    platform,
    username: user.username,
    normalizedUsername,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    updatedAt: new Date(),
  }));

  const rows = await db
    .insert(schema.socialUsers)
    .values(valuesList)
    .onConflictDoUpdate({
      target: [schema.socialUsers.platform, schema.socialUsers.normalizedUsername],
      set: {
        displayName: sql`excluded.display_name`,
        avatarUrl: sql`excluded.avatar_url`,
        isVerified: sql`excluded.is_verified`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();

  return new Map(rows.map((row) => [row.normalizedUsername, row.id]));
}

/** Bumps last_seen_at for members still present and un-marks removedAt, since being captured now means they're not removed. */
async function upsertMemberships(
  db: ReturnType<typeof getDb>,
  profileId: string,
  kind: "follower" | "following",
  socialUserIds: string[],
) {
  if (socialUserIds.length === 0) return;
  const now = new Date();
  const valuesList = socialUserIds.map((socialUserId) => ({ profileId, socialUserId, kind, lastSeenAt: now }));
  await db
    .insert(schema.memberships)
    .values(valuesList)
    .onConflictDoUpdate({
      target: [schema.memberships.profileId, schema.memberships.socialUserId, schema.memberships.kind],
      set: { lastSeenAt: sql`excluded.last_seen_at`, removedAt: sql`null` },
    });
}

async function fetchExistingProfileRow(db: ReturnType<typeof getDb>, platform: Profile["platform"], normalizedUsername: string) {
  const [row] = await db
    .select()
    .from(schema.profiles)
    .where(and(eq(schema.profiles.platform, platform), eq(schema.profiles.normalizedUsername, normalizedUsername)))
    .limit(1);
  return row ?? null;
}

async function fetchLatestSnapshot(db: ReturnType<typeof getDb>, profileId: string) {
  const [row] = await db
    .select()
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileId))
    .orderBy(desc(schema.profileSnapshots.capturedAt))
    .limit(1);
  return row ?? null;
}

/** The set of socialUserIds this profile currently has an un-removed membership row for, i.e. state as of the end of the previous capture. */
async function fetchActiveMembershipIds(
  db: ReturnType<typeof getDb>,
  profileId: string,
  kind: "follower" | "following",
): Promise<Set<string>> {
  const rows = await db
    .select({ socialUserId: schema.memberships.socialUserId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.profileId, profileId), eq(schema.memberships.kind, kind), isNull(schema.memberships.removedAt)));
  return new Set(rows.map((row) => row.socialUserId));
}

async function markMembershipsRemoved(
  db: ReturnType<typeof getDb>,
  profileId: string,
  kind: "follower" | "following",
  socialUserIds: string[],
) {
  if (socialUserIds.length === 0) return;
  await db
    .update(schema.memberships)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(schema.memberships.profileId, profileId),
        eq(schema.memberships.kind, kind),
        inArray(schema.memberships.socialUserId, socialUserIds),
      ),
    );
}

/**
 * Diffs one membership kind (follower/following) between the previous
 * snapshot's active set and this capture's set, and returns the
 * change_events rows to insert — but only when coverage was near-complete
 * on *both* sides. Per spec §20, a capped/partial capture must never be
 * used to infer mass removal or addition: a member missing from this
 * snapshot's 500-item sample might simply be outside the cap, not gone;
 * likewise "added" is only meaningful if the previous capture would have
 * seen them too. Below the threshold, this returns no events at all for
 * that kind, which is the honest "comparison unavailable" outcome, rather
 * than a misleading partial diff.
 */
function diffMembership(
  kind: "follower" | "following",
  previousActiveIds: Set<string>,
  previousCoveragePercent: number,
  currentIds: Set<string>,
  currentCoveragePercent: number,
): { added: string[]; removed: string[] } {
  if (previousCoveragePercent < DIFF_COVERAGE_THRESHOLD || currentCoveragePercent < DIFF_COVERAGE_THRESHOLD) {
    return { added: [], removed: [] };
  }
  const added = [...currentIds].filter((id) => !previousActiveIds.has(id));
  const removed = [...previousActiveIds].filter((id) => !currentIds.has(id));
  return { added, removed };
}

function diffProfileFields(
  before: typeof schema.profiles.$inferSelect,
  after: Profile,
): Array<{ field: string; oldValue: string; newValue: string }> {
  const pairs: Array<[string, string, string]> = [
    ["displayName", before.displayName, after.displayName],
    ["bio", before.bio, after.bio],
    ["avatarUrl", before.avatarUrl, after.avatarUrl],
    ["isVerified", String(before.isVerified), String(after.isVerified)],
    ["isPrivate", String(before.isPrivate), String(after.isPrivate)],
  ];
  return pairs
    .filter(([, oldValue, newValue]) => oldValue !== newValue)
    .map(([field, oldValue, newValue]) => ({ field, oldValue, newValue }));
}

export async function captureSnapshot(username: string): Promise<SnapshotSummary> {
  const db = getDb();
  const { profile } = await provider.getProfile(username);
  const normalizedUsername = normalizeUsername(profile.username);

  const existingProfileRow = await fetchExistingProfileRow(db, profile.platform, normalizedUsername);
  const previousSnapshotRow = existingProfileRow ? await fetchLatestSnapshot(db, existingProfileRow.id) : null;
  const [previousActiveFollowerIds, previousActiveFollowingIds] = existingProfileRow
    ? await Promise.all([
        fetchActiveMembershipIds(db, existingProfileRow.id, "follower"),
        fetchActiveMembershipIds(db, existingProfileRow.id, "following"),
      ])
    : [new Set<string>(), new Set<string>()];

  const [followers, following] = await Promise.all([
    collectPages((cursor) => provider.getFollowers(profile.id, cursor, PAGE_SIZE), SNAPSHOT_MEMBER_LIMIT),
    collectPages((cursor) => provider.getFollowing(profile.id, cursor, PAGE_SIZE), SNAPSHOT_MEMBER_LIMIT),
  ]);

  const profileRow = await upsertProfileRow(db, profile);
  const [followerIdByUsername, followingIdByUsername] = await Promise.all([
    upsertSocialUsers(db, profile.platform, followers),
    upsertSocialUsers(db, profile.platform, following),
  ]);

  await Promise.all([
    upsertMemberships(db, profileRow.id, "follower", [...followerIdByUsername.values()]),
    upsertMemberships(db, profileRow.id, "following", [...followingIdByUsername.values()]),
  ]);

  const followerCoveragePercent = coveragePercentFor(followers.length, profile.followerCount);
  const followingCoveragePercent = coveragePercentFor(following.length, profile.followingCount);

  const [snapshotRow] = await db
    .insert(schema.profileSnapshots)
    .values({
      profileId: profileRow.id,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      postCount: profile.postCount,
      indexedFollowerCount: followers.length,
      indexedFollowingCount: following.length,
      followerCoveragePercent: followerCoveragePercent.toString(),
      followingCoveragePercent: followingCoveragePercent.toString(),
    })
    .returning();

  if (existingProfileRow && previousSnapshotRow) {
    const currentFollowerIds = new Set(followerIdByUsername.values());
    const currentFollowingIds = new Set(followingIdByUsername.values());
    const followerDiff = diffMembership(
      "follower",
      previousActiveFollowerIds,
      Number(previousSnapshotRow.followerCoveragePercent),
      currentFollowerIds,
      followerCoveragePercent,
    );
    const followingDiff = diffMembership(
      "following",
      previousActiveFollowingIds,
      Number(previousSnapshotRow.followingCoveragePercent),
      currentFollowingIds,
      followingCoveragePercent,
    );

    await Promise.all([
      markMembershipsRemoved(db, profileRow.id, "follower", followerDiff.removed),
      markMembershipsRemoved(db, profileRow.id, "following", followingDiff.removed),
    ]);

    const membershipEventRows = (
      [
        ["follower", followerDiff] as const,
        ["following", followingDiff] as const,
      ] as const
    ).flatMap(([kind, diff]) => [
      ...diff.added.map((socialUserId) => ({
        profileId: profileRow.id,
        fromSnapshotId: previousSnapshotRow.id,
        toSnapshotId: snapshotRow.id,
        membershipEvent: "added" as const,
        membershipKind: kind,
        socialUserId,
      })),
      ...diff.removed.map((socialUserId) => ({
        profileId: profileRow.id,
        fromSnapshotId: previousSnapshotRow.id,
        toSnapshotId: snapshotRow.id,
        membershipEvent: "removed" as const,
        membershipKind: kind,
        socialUserId,
      })),
    ]);

    const fieldChangeRows = diffProfileFields(existingProfileRow, profile).map(({ field, oldValue, newValue }) => ({
      profileId: profileRow.id,
      fromSnapshotId: previousSnapshotRow.id,
      toSnapshotId: snapshotRow.id,
      field,
      oldValue,
      newValue,
    }));

    const allRows = [...membershipEventRows, ...fieldChangeRows];
    if (allRows.length > 0) {
      await db.insert(schema.changeEvents).values(allRows);
    }
  }

  return toSnapshotSummary(snapshotRow);
}

export async function listSnapshots(username: string, limit = 20): Promise<SnapshotSummary[]> {
  const db = getDb();
  const [profileRow] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.platform, "instagram"), eq(schema.profiles.normalizedUsername, normalizeUsername(username))))
    .limit(1);

  if (!profileRow) return [];

  const rows = await db
    .select()
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileRow.id))
    .orderBy(desc(schema.profileSnapshots.capturedAt))
    .limit(limit);

  return rows.map(toSnapshotSummary);
}
