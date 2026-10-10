import { and, count, desc, eq } from "drizzle-orm";

import type { SocialUser } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";
import { provider } from "@/lib/providers";
import { upsertProfileRow } from "@/lib/snapshot/capture";
import { assertWithinLimit, type Plan } from "@/lib/billing/plans";

/**
 * Spec §22 Saved Searches: a saved query, matched against username and
 * display name, on one profile's follower or following list.
 *
 * The intended output was "3 new matching accounts, 1 removed matching
 * account" between two snapshots. Snapshot capture stores no follower or
 * following accounts (src/lib/snapshot/capture.ts), and
 * src/lib/diff/compare.ts is count-only, so that member-level comparison
 * cannot be computed. Every saved search reports `available: false` with
 * MEMBER_CHANGES_UNAVAILABLE_REASON. `newMatches` and `removedMatches` are
 * always empty; they stay on the type so existing callers keep compiling.
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

const MEMBER_CHANGES_UNAVAILABLE_REASON = "Member-level changes are not recorded any more.";

export function matches(user: SocialUser, query: string): boolean {
  const needle = query.toLowerCase();
  return user.username.toLowerCase().includes(needle) || user.displayName.toLowerCase().includes(needle);
}

export async function createSavedSearch(
  username: string,
  kind: "follower" | "following",
  query: string,
  visitorId: string,
  plan?: Plan,
): Promise<void> {
  const db = getDb();
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  const { profile } = await provider.getProfile(username);
  const profileRow = await upsertProfileRow(db, profile);

  if (plan) {
    const [existing] = await db
      .select({ id: schema.savedSearches.id })
      .from(schema.savedSearches)
      .where(
        and(
          eq(schema.savedSearches.visitorId, visitorId),
          eq(schema.savedSearches.profileId, profileRow.id),
          eq(schema.savedSearches.kind, kind),
          eq(schema.savedSearches.query, trimmedQuery),
        ),
      )
      .limit(1);
    if (!existing) {
      const [row] = await db
        .select({ value: count() })
        .from(schema.savedSearches)
        .where(eq(schema.savedSearches.visitorId, visitorId));
      assertWithinLimit(plan, "saved searches", row.value);
    }
  }

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

  return rows.map(
    (row): SavedSearchResult => ({
      ...row,
      available: false,
      reason: MEMBER_CHANGES_UNAVAILABLE_REASON,
      newMatches: [],
      removedMatches: [],
    }),
  );
}
