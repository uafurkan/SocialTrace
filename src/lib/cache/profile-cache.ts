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

import type { Platform, Profile } from "@/lib/domain/types";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getProvider } from "@/lib/providers";

export const PROFILE_CACHE_TTL_MS = (Number(process.env.PROFILE_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

export function isFresh(fetchedAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - fetchedAt.getTime() < ttlMs;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function readCache(platform: Platform, normalizedUsername: string) {
  const db = getDb();
  // Filtered by normalizedUsername in SQL, then platform in JS — not
  // and(eq(...), eq(...)) in the query itself, which was observed to
  // spuriously return zero rows in the Next.js dev server runtime despite
  // each condition matching individually (root cause never pinned down).
  // Now that a second/third platform actually exists (tiktok, facebook),
  // relying on normalizedUsername alone would risk one platform's cached
  // row being served for another's identically-named account — the JS
  // filter below is what actually enforces (platform, normalizedUsername)
  // as the real lookup key, matching the DB's own unique constraint.
  const rows = await db
    .select()
    .from(schema.profileCache)
    .where(eq(schema.profileCache.normalizedUsername, normalizedUsername));
  return rows.find((row) => row.platform === platform) ?? null;
}

async function writeCache(platform: Platform, normalizedUsername: string, profile: Profile) {
  const db = getDb();
  await db
    .insert(schema.profileCache)
    .values({
      platform,
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
 * cared about `{ profile }` don't need to change. `platform` defaults to
 * "instagram" so every pre-existing call site keeps working unchanged.
 */
export async function getCachedProfile(username: string, platform: Platform = "instagram"): Promise<{ profile: Profile }> {
  const provider = getProvider(platform);
  if (!isDbConfigured()) {
    return provider.getProfile(username);
  }

  const normalizedUsername = normalizeUsername(username);
  const cached = await readCache(platform, normalizedUsername);
  if (cached && isFresh(cached.fetchedAt, new Date(), PROFILE_CACHE_TTL_MS)) {
    return { profile: cached.data as Profile };
  }

  const result = await provider.getProfile(username);
  await writeCache(platform, normalizedUsername, result.profile);
  return result;
}
