/**
 * Cost-control cache in front of `provider.getProfile` (docs/DECISIONS.md).
 * A real provider (Apify) bills per call, and most homepage searches are
 * one-shot visitors looking up the same handful of popular profiles — so
 * this makes at most one real fetch per profile per TTL window, regardless
 * of how many people search it in that window.
 *
 * "Only pay again if the profile actually changed" isn't something a cache
 * can know in advance — the only way to find out something changed is to
 * fetch it. A time-boxed TTL is the practical equivalent: cheap, and
 * bounds worst-case staleness. Falls back to calling the provider directly
 * when no database is configured, same as the rest of the DB-backed
 * features in this build.
 */
import { eq } from "drizzle-orm";

import type { Profile } from "@/lib/domain/types";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { provider } from "@/lib/providers";

export const PROFILE_CACHE_TTL_MS = (Number(process.env.PROFILE_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

export function isFresh(fetchedAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - fetchedAt.getTime() < ttlMs;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function readCache(normalizedUsername: string) {
  const db = getDb();
  // Filtered on normalizedUsername alone, not also platform: this app only
  // ever writes platform="instagram" rows, and combining it via and(eq(...),
  // eq(...)) here was observed to spuriously return zero rows in the Next.js
  // dev server runtime despite each condition matching individually and the
  // same combined query working fine outside Next.js — root cause not
  // pinned down, and (platform, normalizedUsername) is still the real
  // primary key enforced at the DB level for writes.
  const [row] = await db
    .select()
    .from(schema.profileCache)
    .where(eq(schema.profileCache.normalizedUsername, normalizedUsername))
    .limit(1);
  return row ?? null;
}

async function writeCache(normalizedUsername: string, profile: Profile) {
  const db = getDb();
  await db
    .insert(schema.profileCache)
    .values({
      platform: "instagram",
      normalizedUsername,
      data: profile,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.profileCache.platform, schema.profileCache.normalizedUsername],
      set: { data: profile, fetchedAt: new Date() },
    });
}

/**
 * Same return shape/errors as `provider.getProfile` — callers that only
 * cared about `{ profile }` don't need to change.
 */
export async function getCachedProfile(username: string): Promise<{ profile: Profile }> {
  if (!isDbConfigured()) {
    return provider.getProfile(username);
  }

  const normalizedUsername = normalizeUsername(username);
  const cached = await readCache(normalizedUsername);
  if (cached && isFresh(cached.fetchedAt, new Date(), PROFILE_CACHE_TTL_MS)) {
    return { profile: cached.data as Profile };
  }

  const result = await provider.getProfile(username);
  await writeCache(normalizedUsername, result.profile);
  return result;
}
