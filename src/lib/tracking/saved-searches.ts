import { and, desc, eq } from "drizzle-orm";

import type { SocialUser } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";
import { compareSnapshots } from "@/lib/diff/compare";
import { provider } from "@/lib/providers";
import { upsertProfileRow } from "@/lib/snapshot/capture";

/**
 * Spec §22 Saved Searches, built on top of the follower comparison
 * reconstruction (src/lib/diff/compare.ts) rather than a separate
 * mechanism: "3 new matching accounts, 1 removed matching account" is
 * exactly compareSnapshots's newMembers/removedMembers between a
 * profile's two most recent snapshots, filtered by the saved query
 * string against username/displayName.
 */
export interface SavedSearchResult {
  id: string;
  profileId: string;
  username: string;
  kind: "follower" | "following";
  query: string;
  available: boolean;
  reason: string | null;
  newMatches: SocialUser[];
  removedMatches: SocialUser[];
}

function matches(user: SocialUser, query: string): boolean {
  const needle = query.toLowerCase();
  return user.username.toLowerCase().includes(needle) || user.displayName.toLowerCase().includes(needle);
}

export async function createSavedSearch(
  username: string,
  kind: "follower" | "following",
  query: string,
  visitorId: string,
): Promise<void> {
  const db = getDb();
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;
  const { profile } = await provider.getProfile(username);
  const profileRow = await upsertProfileRow(db, profile);
  await db
    .insert(schema.savedSearches)
    .values({ visitorId, profileId: profileRow.id, kind, query: trimmedQuery })
    .onConflictDoNothing({
      target: [schema.savedSearches.visitorId, schema.savedSearches.profileId, schema.savedSearches.kind, schema.savedSearches.query],
    });
}

export async function deleteSavedSearch(id: string, visitorId: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.savedSearches).where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.visitorId, visitorId)));
}

async function latestTwoSnapshotIds(db: ReturnType<typeof getDb>, profileId: string): Promise<[string, string] | null> {
  const rows = await db
    .select({ id: schema.profileSnapshots.id })
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileId))
    .orderBy(desc(schema.profileSnapshots.capturedAt))
    .limit(2);
  if (rows.length < 2) return null;
  return [rows[1].id, rows[0].id];
}

export async function listSavedSearches(visitorId: string): Promise<SavedSearchResult[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.savedSearches.id,
      profileId: schema.savedSearches.profileId,
      username: schema.profiles.username,
      kind: schema.savedSearches.kind,
      query: schema.savedSearches.query,
    })
    .from(schema.savedSearches)
    .innerJoin(schema.profiles, eq(schema.savedSearches.profileId, schema.profiles.id))
    .where(eq(schema.savedSearches.visitorId, visitorId))
    .orderBy(desc(schema.savedSearches.createdAt));

  return Promise.all(
    rows.map(async (row): Promise<SavedSearchResult> => {
      const snapshotIds = await latestTwoSnapshotIds(db, row.profileId);
      if (!snapshotIds) {
        return {
          ...row,
          available: false,
          reason: "Capture at least two snapshots of this profile to see matching changes here.",
          newMatches: [],
          removedMatches: [],
        };
      }
      const comparison = await compareSnapshots(row.username, row.kind, snapshotIds[0], snapshotIds[1]);
      if (!comparison || !comparison.available) {
        return {
          ...row,
          available: false,
          reason: comparison?.reason ?? "Comparison unavailable.",
          newMatches: [],
          removedMatches: [],
        };
      }
      return {
        ...row,
        available: true,
        reason: null,
        newMatches: comparison.newMembers.filter((user) => matches(user, row.query)),
        removedMatches: comparison.removedMembers.filter((user) => matches(user, row.query)),
      };
    }),
  );
}
