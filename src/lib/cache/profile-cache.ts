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
import { ProfileNotFoundError } from "@/lib/providers/types";

export const PROFILE_CACHE_TTL_MS = (Number(process.env.PROFILE_CACHE_TTL_HOURS) || 6) * 60 * 60 * 1000;

/**
 * How long a "this profile does not exist" answer is reused. Short on purpose:
 * accounts get created, and a provider can report a missing profile during a
 * block. An hour stops a dead handle from billing on every lookup without
 * hiding a newly created account for long.
 */
export const NOT_FOUND_TTL_MS = 60 * 60 * 1000;

/**
 * Stored in the same `profile_cache` row as a profile, in place of one, after
 * a confirmed ProfileNotFoundError. It has no `notFound` field a real Profile
 * could carry, so it cannot be mistaken for profile data.
 */
const NOT_FOUND_MARKER = { notFound: true } as const;
type NotFoundMarker = typeof NOT_FOUND_MARKER;

function isNotFoundMarker(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { notFound?: unknown }).notFound === true;
}

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

/**
 * Exposed for background sources that can't answer within a request's
 * lifetime (Bright Data — see providers/brightdata/profile.ts): they trigger
 * a job, return `null` immediately so the current request falls through to
 * the next source as usual, then call this once the job completes so the
 * *next* visit to this profile is a fast cache hit instead of another slow
 * background job.
 */
export async function writeCachedProfile(platform: Platform, username: string, profile: Profile): Promise<void> {
  await writeCache(platform, normalizeUsername(username), profile);
}

async function writeCache(platform: Platform, normalizedUsername: string, data: Profile | NotFoundMarker) {
  const db = getDb();
  await db
    .insert(schema.profileCache)
    .values({
      platform,
      normalizedUsername,
      data,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.profileCache.platform, schema.profileCache.normalizedUsername],
      set: { data, fetchedAt: new Date() },
    });
}

/**
 * Best-effort: a failed marker write must not hide the ProfileNotFoundError
 * the caller is about to receive, and the cost of losing it is one extra
 * provider call on the next lookup.
 */
async function writeNotFoundMarker(platform: Platform, normalizedUsername: string) {
  try {
    await writeCache(platform, normalizedUsername, NOT_FOUND_MARKER);
  } catch (error) {
    console.error(`[profile-cache] failed to write not-found marker for ${platform}/${normalizedUsername}`, error);
  }
}

/**
 * Same return shape/errors as `provider.getProfile` — callers that only
 * cared about `{ profile }` don't need to change. `platform` defaults to
 * "instagram" so every pre-existing call site keeps working unchanged.
 *
 * A ProfileNotFoundError from the provider is stored as a 1-hour marker under
 * the same key, and a fresh marker is re-thrown without calling the provider.
 * Transient errors store nothing. This only applies when a database is
 * configured; without one the provider is called directly every time.
 */
export async function getCachedProfile(username: string, platform: Platform = "instagram"): Promise<{ profile: Profile }> {
  const provider = getProvider(platform);
  if (!isDbConfigured()) {
    return provider.getProfile(username);
  }

  const normalizedUsername = normalizeUsername(username);
  const cached = await readCache(platform, normalizedUsername);
  const now = new Date();
  if (cached && isNotFoundMarker(cached.data)) {
    // An expired marker falls through to a real lookup. It is never returned
    // as a profile, and never served as stale data below.
    if (isFresh(cached.fetchedAt, now, NOT_FOUND_TTL_MS)) {
      throw new ProfileNotFoundError(username);
    }
  } else if (cached && isFresh(cached.fetchedAt, now, PROFILE_CACHE_TTL_MS)) {
    return { profile: cached.data as Profile };
  }

  try {
    const result = await provider.getProfile(username);
    await writeCache(platform, normalizedUsername, result.profile);
    return result;
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      await writeNotFoundMarker(platform, normalizedUsername);
      throw error;
    }
    // Last known good. An expired row used to be discarded outright, which
    // meant that when the provider was unreachable — an exhausted Apify quota,
    // an actor outage — a profile we had successfully fetched a hundred times
    // returned a hard error instead of slightly old data. Serving it is both
    // more useful and still honest: `Profile.followerCoverage.lastCheckedAt`
    // carries the original fetch time and `CoverageBadge` already renders it,
    // so the page says exactly how old this is without any UI change.
    //
    // ProfileNotFoundError is deliberately *not* served stale — "this profile
    // does not exist" is a real answer about the profile, not a source
    // failure, and must not be papered over with a stale row. An expired
    // not-found marker is not a profile either, so it is never returned here.
    if (cached && !isNotFoundMarker(cached.data)) {
      console.warn(
        `[profile-cache] serving stale ${platform}/${normalizedUsername} (fetched ${cached.fetchedAt.toISOString()}) — provider unavailable:`,
        error instanceof Error ? error.message : error,
      );
      return { profile: cached.data as Profile };
    }
    throw error;
  }
}
