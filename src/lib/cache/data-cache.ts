/**
 * Generalizes profile-cache.ts's TTL cache to every other per-profile
 * provider call (posts, reels, stories, highlights, tagged posts,
 * followers, following). These had no caching at all — every tab click
 * re-hit Apify from scratch, including multi-actor fallback chains for
 * followers/following — which was both an unbounded bill and the direct
 * cause of tab switches taking a minute or more in production.
 */
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { ProfileNotFoundError } from "@/lib/providers/types";
import { isFresh } from "./profile-cache";

export const DATA_CACHE_TTL_MS = (Number(process.env.DATA_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-resource TTLs, because "how long is this still true?" genuinely differs
 * by resource and a single global window either wastes money on stable data or
 * serves expired data:
 *
 * - followers/following change slowly for most accounts and are by far the
 *   most expensive thing here (a five-actor fallback chain per miss), so they
 *   get the longest window.
 * - stories expire on their own after 24h, so a long TTL would serve stories
 *   that no longer exist — shorter than the default, not longer.
 * - posts/reels keep the existing default.
 */
export const RESOURCE_CACHE_TTL_MS = {
  posts: DATA_CACHE_TTL_MS,
  reels: DATA_CACHE_TTL_MS,
  followers: 48 * HOUR_MS,
  following: 48 * HOUR_MS,
  stories: 1 * HOUR_MS,
} as const;

/** Picks the TTL for a `resource:profileId` cache key, falling back to the global default. */
export function ttlForCacheKey(cacheKey: string): number {
  const resource = cacheKey.split(":")[0] as keyof typeof RESOURCE_CACHE_TTL_MS;
  return RESOURCE_CACHE_TTL_MS[resource] ?? DATA_CACHE_TTL_MS;
}

async function readCache(cacheKey: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.providerCache).where(eq(schema.providerCache.cacheKey, cacheKey)).limit(1);
  return row ?? null;
}

async function writeCache(cacheKey: string, data: unknown) {
  const db = getDb();
  await db
    .insert(schema.providerCache)
    .values({ cacheKey, data, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.providerCache.cacheKey,
      set: { data, fetchedAt: new Date() },
    });
}

/**
 * Runs `fetchFn` only on a cache miss/stale entry; a fresh cached result
 * short-circuits it entirely. Falls back to calling `fetchFn` directly
 * when no database is configured, same as profile-cache.ts. A cache write
 * failure is logged and swallowed rather than failing a request that
 * already has a good result to return.
 */
export async function withDataCache<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<T> {
  if (!isDbConfigured()) {
    return fetchFn();
  }

  const cached = await readCache(cacheKey);
  if (cached && isFresh(cached.fetchedAt, new Date(), ttlForCacheKey(cacheKey))) {
    return cached.data as T;
  }

  let result: T;
  try {
    result = await fetchFn();
  } catch (error) {
    // Last known good, same reasoning as profile-cache.ts: an expired row is
    // far more useful than an error for resources that have no free fallback
    // source at all (followers, stories, highlights — all Apify-only). Without
    // this, an exhausted quota empties tabs that have working cached data
    // sitting right there.
    //
    // ProfileNotFoundError is excluded for the same reason as in
    // profile-cache.ts: a confirmed "this profile is gone" is a real answer,
    // and replaying a cached copy of a deleted account would be the cache
    // asserting something untrue rather than merely something old.
    if (cached && !(error instanceof ProfileNotFoundError)) {
      console.warn(
        `[data-cache] serving stale ${cacheKey} (fetched ${cached.fetchedAt.toISOString()}) — source unavailable:`,
        error instanceof Error ? error.message : error,
      );
      return cached.data as T;
    }
    throw error;
  }

  try {
    await writeCache(cacheKey, result);
  } catch (error) {
    console.error(`[data-cache] failed to write cache for ${cacheKey}`, error);
  }
  return result;
}
