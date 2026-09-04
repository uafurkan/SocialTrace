import { and, desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { provider } from "@/lib/providers";
import { normalizeUsername, upsertProfileRow } from "@/lib/snapshot/capture";

/**
 * Spec §21 Tracking/Watchlist, scoped to what's possible without accounts
 * or a scheduler (see the comment on watchlistEntries in src/lib/db/schema.ts
 * and docs/TRACKING.md). "Tracked" here means: this anonymous visitor
 * clicked Track, and the profile shows up on their /tracking dashboard —
 * there is no recurring automatic re-capture.
 */
export interface TrackedProfileSummary {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  latestSnapshotAt: string | null;
  followerDeltaSinceLastSnapshot: number | null;
}

export async function isProfileTracked(username: string, visitorId: string): Promise<boolean> {
  const db = getDb();
  const normalizedUsername = normalizeUsername(username);
  const [row] = await db
    .select({ id: schema.watchlistEntries.id })
    .from(schema.watchlistEntries)
    .innerJoin(schema.profiles, eq(schema.watchlistEntries.profileId, schema.profiles.id))
    .where(
      and(
        eq(schema.watchlistEntries.visitorId, visitorId),
        eq(schema.profiles.platform, "instagram"),
        eq(schema.profiles.normalizedUsername, normalizedUsername),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Fetches the profile fresh (so a never-before-seen profile can be tracked without first capturing a snapshot) and upserts a minimal profiles row for the watchlist entry to reference. */
export async function trackProfile(username: string, visitorId: string): Promise<void> {
  const db = getDb();
  const { profile } = await provider.getProfile(username);
  const profileRow = await upsertProfileRow(db, profile);
  await db
    .insert(schema.watchlistEntries)
    .values({ visitorId, profileId: profileRow.id })
    .onConflictDoNothing({ target: [schema.watchlistEntries.visitorId, schema.watchlistEntries.profileId] });
}

export async function untrackProfile(username: string, visitorId: string): Promise<void> {
  const db = getDb();
  const normalizedUsername = normalizeUsername(username);
  const [profileRow] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.platform, "instagram"), eq(schema.profiles.normalizedUsername, normalizedUsername)))
    .limit(1);
  if (!profileRow) return;
  await db
    .delete(schema.watchlistEntries)
    .where(and(eq(schema.watchlistEntries.visitorId, visitorId), eq(schema.watchlistEntries.profileId, profileRow.id)));
}

/** The two most recent snapshots' follower counts for one profile, for the "+N since last snapshot" line — null when there's fewer than two, since a delta needs a prior point of comparison. */
async function followerDeltaFor(db: ReturnType<typeof getDb>, profileId: string) {
  const rows = await db
    .select({ followerCount: schema.profileSnapshots.followerCount, capturedAt: schema.profileSnapshots.capturedAt })
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileId))
    .orderBy(desc(schema.profileSnapshots.capturedAt))
    .limit(2);

  if (rows.length === 0) return { latestSnapshotAt: null, delta: null };
  if (rows.length === 1) return { latestSnapshotAt: rows[0].capturedAt.toISOString(), delta: null };
  return {
    latestSnapshotAt: rows[0].capturedAt.toISOString(),
    delta: rows[0].followerCount - rows[1].followerCount,
  };
}

export async function listTrackedProfiles(visitorId: string): Promise<TrackedProfileSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.profiles.id,
      username: schema.profiles.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
      followerCount: schema.profiles.followerCount,
      trackedAt: schema.watchlistEntries.createdAt,
    })
    .from(schema.watchlistEntries)
    .innerJoin(schema.profiles, eq(schema.watchlistEntries.profileId, schema.profiles.id))
    .where(eq(schema.watchlistEntries.visitorId, visitorId))
    .orderBy(desc(schema.watchlistEntries.createdAt));

  return Promise.all(
    rows.map(async (row) => {
      const { latestSnapshotAt, delta } = await followerDeltaFor(db, row.profileId);
      return {
        profileId: row.profileId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        followerCount: row.followerCount,
        latestSnapshotAt,
        followerDeltaSinceLastSnapshot: delta,
      };
    }),
  );
}
