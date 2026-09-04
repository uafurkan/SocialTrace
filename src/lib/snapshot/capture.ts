import { and, desc, eq, sql } from "drizzle-orm";

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

/** Bumps last_seen_at for members still present; does not mark anything removed — that comparison is the diff engine's job, not the snapshot's (spec §20's "don't infer removal from lower coverage" rule lives there). */
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

export async function captureSnapshot(username: string): Promise<SnapshotSummary> {
  const db = getDb();
  const { profile } = await provider.getProfile(username);

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

  const [snapshotRow] = await db
    .insert(schema.profileSnapshots)
    .values({
      profileId: profileRow.id,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      postCount: profile.postCount,
      indexedFollowerCount: followers.length,
      indexedFollowingCount: following.length,
      followerCoveragePercent: coveragePercentFor(followers.length, profile.followerCount).toString(),
      followingCoveragePercent: coveragePercentFor(following.length, profile.followingCount).toString(),
    })
    .returning();

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
