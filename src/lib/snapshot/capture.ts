import { and, desc, eq } from "drizzle-orm";

import type { Profile, SnapshotSummary } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";
import { provider } from "@/lib/providers";

/**
 * Spec §19's snapshot lifecycle (REQUESTED -> QUEUED -> COLLECTING ->
 * NORMALIZING -> VALIDATING -> INDEXING -> COMPLETED) assumes a job queue.
 * This build has none (see docs/KNOWN_LIMITATIONS.md), so a "snapshot" here
 * is captured synchronously, in one request, the same honest-scope
 * reduction as the export system (docs/EXPORT.md).
 *
 * A snapshot stores only the profile's own data: the profile row (username,
 * display name, bio, avatar, flags, counts) and one profile_snapshots row.
 * Follower and following lists are never fetched or stored, so a capture
 * writes no third party's identity (docs/SNAPSHOTS.md, docs/SNAPSHOT_PLAN.md
 * section 3).
 */

/**
 * Indexed member count and coverage written by every capture: no follower or
 * following identity is stored, so none is indexed. profile_snapshots's
 * indexed/coverage columns are NOT NULL (src/lib/db/schema.ts), so zero is
 * written rather than null.
 */
const NO_MEMBERS_INDEXED = 0;
const NO_MEMBER_COVERAGE = "0";

/**
 * Minimum coverage on both sides of a member comparison (src/lib/diff/compare.ts).
 * Captures no longer index members, so new snapshots never reach it and any
 * comparison that uses them reports "unavailable" (spec §20: never infer
 * removal from a partial capture).
 */
export const DIFF_COVERAGE_THRESHOLD = 99.5;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
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

/**
 * `existingRowId`, when given, is the row already found in captureSnapshot's
 * externalId-or-username lookup (see fetchExistingProfileRow) — updating it
 * directly by id is what makes a rename land on the *same* row instead of
 * creating a new one: the (platform, normalized_username) ON CONFLICT target
 * below can only match when the incoming username is unchanged, so a rename
 * would otherwise insert a fresh row rather than update the existing one.
 */
export async function upsertProfileRow(db: ReturnType<typeof getDb>, profile: Profile, existingRowId?: string) {
  const values = {
    platform: profile.platform,
    username: profile.username,
    normalizedUsername: normalizeUsername(profile.username),
    externalId: profile.externalId,
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

  if (existingRowId) {
    const [row] = await db.update(schema.profiles).set(values).where(eq(schema.profiles.id, existingRowId)).returning();
    return row;
  }

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

/**
 * Looks up by the platform's own stable id first — the one thing that
 * survives a rename — falling back to (platform, normalized_username) for
 * rows captured before external_id existed, or when the provider has none
 * to give (Facebook Pages; externalId is null). See docs/DECISIONS.md.
 */
export async function fetchExistingProfileRow(
  db: ReturnType<typeof getDb>,
  platform: Profile["platform"],
  normalizedUsername: string,
  externalId: string | null,
) {
  if (externalId) {
    const [byExternalId] = await db
      .select()
      .from(schema.profiles)
      .where(and(eq(schema.profiles.platform, platform), eq(schema.profiles.externalId, externalId)))
      .limit(1);
    if (byExternalId) return byExternalId;
  }
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

/** Profile fields that differ between the stored row and this capture, as change_events field/old/new triples. */
function diffProfileFields(
  before: typeof schema.profiles.$inferSelect,
  after: Profile,
): Array<{ field: string; oldValue: string; newValue: string }> {
  const pairs: Array<[string, string, string]> = [
    ["username", before.username, after.username],
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

/**
 * Captures one snapshot of the profile's own data. It writes the profile row,
 * one profile_snapshots row with the public counts, and change_events for any
 * profile fields that changed since the previous snapshot. Follower and
 * following lists are not requested, so their indexed count is recorded as 0.
 */
export async function captureSnapshot(username: string): Promise<SnapshotSummary> {
  const db = getDb();
  const { profile } = await provider.getProfile(username);
  const normalizedUsername = normalizeUsername(profile.username);

  const existingProfileRow = await fetchExistingProfileRow(db, profile.platform, normalizedUsername, profile.externalId);
  const previousSnapshotRow = existingProfileRow ? await fetchLatestSnapshot(db, existingProfileRow.id) : null;

  const profileRow = await upsertProfileRow(db, profile, existingProfileRow?.id);

  const [snapshotRow] = await db
    .insert(schema.profileSnapshots)
    .values({
      profileId: profileRow.id,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      postCount: profile.postCount,
      indexedFollowerCount: NO_MEMBERS_INDEXED,
      indexedFollowingCount: NO_MEMBERS_INDEXED,
      followerCoveragePercent: NO_MEMBER_COVERAGE,
      followingCoveragePercent: NO_MEMBER_COVERAGE,
    })
    .returning();

  if (existingProfileRow && previousSnapshotRow) {
    const fieldChangeRows = diffProfileFields(existingProfileRow, profile).map(({ field, oldValue, newValue }) => ({
      profileId: profileRow.id,
      fromSnapshotId: previousSnapshotRow.id,
      toSnapshotId: snapshotRow.id,
      field,
      oldValue,
      newValue,
    }));
    if (fieldChangeRows.length > 0) {
      await db.insert(schema.changeEvents).values(fieldChangeRows);
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
