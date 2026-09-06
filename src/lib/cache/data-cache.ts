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
import { isFresh } from "./profile-cache";

export const DATA_CACHE_TTL_MS = (Number(process.env.DATA_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

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
  if (cached && isFresh(cached.fetchedAt, new Date(), DATA_CACHE_TTL_MS)) {
    return cached.data as T;
  }

  const result = await fetchFn();
  try {
    await writeCache(cacheKey, result);
  } catch (error) {
    console.error(`[data-cache] failed to write cache for ${cacheKey}`, error);
  }
  return result;
}
