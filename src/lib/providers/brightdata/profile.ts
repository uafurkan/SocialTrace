/**
 * Maps Bright Data's Datasets API responses onto the shared `Profile` shape,
 * one function per platform — see client.ts for why this exists (an
 * independent free quota from Apify's).
 *
 * Fire-and-forget, not a request-time fallback: live testing found
 * completion time too variable to ever block a page load on (Instagram
 * ~50s on one run, still not ready at 50s on the next; Facebook ~66s;
 * TikTok's equivalent dataset ran past 150s without finishing and isn't
 * wired in at all — see docs/KNOWN_LIMITATIONS.md). So `warmBrightData*`
 * functions trigger a job and return immediately without its data; the
 * current request falls through to Apify/stale-cache/honest-unavailable
 * exactly as it did before Bright Data existed. Next's `after()` keeps
 * polling in the background once the response has already gone out, and
 * writes the result into the same profile cache Apify/the free source use
 * — so the *next* visit to this profile, even seconds later, is a normal
 * fast cache hit instead of another slow job.
 */
import { after } from "next/server";

import type { Platform, Profile } from "@/lib/domain/types";
import { writeCachedProfile } from "@/lib/cache/profile-cache";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";
import { BrightDataError, pollBrightDataSnapshot, triggerBrightDataDataset } from "./client";

const INSTAGRAM_PROFILES_DATASET_ID = "gd_l1vikfch901nx3by4";
const FACEBOOK_POSTS_BY_PROFILE_DATASET_ID = "gd_lkaxegm826bjpoo9m5";

// Generous — this runs in the background after the response has already
// been sent, not blocking anyone. Still bounded so a stuck job can't run
// forever (TikTok-scale delays are exactly why this cap exists).
const BACKGROUND_MAX_WAIT_MS = 4 * 60 * 1000;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

interface BrightDataInstagramRecord {
  account?: unknown;
  id?: unknown;
  followers?: unknown;
  following?: unknown;
  posts_count?: unknown;
  is_verified?: unknown;
  is_private?: unknown;
  biography?: unknown;
  profile_image_link?: unknown;
  full_name?: unknown;
}

function mapInstagramRecord(item: BrightDataInstagramRecord | undefined): Profile | null {
  if (!item || typeof item.account !== "string") return null;

  const followerCount = num(item.followers);
  const followingCount = num(item.following);

  return {
    id: `profile_${item.account}`,
    externalId: typeof item.id === "string" ? item.id : null,
    platform: "instagram",
    username: item.account,
    displayName: text(item.full_name) || item.account,
    bio: text(item.biography),
    avatarUrl: text(item.profile_image_link),
    isVerified: item.is_verified === true,
    isPrivate: item.is_private === true,
    followerCount,
    followingCount,
    postCount: num(item.posts_count),
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_FETCH_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_FETCH_CAP), followingCount),
  };
}

interface BrightDataFacebookPostRecord {
  page_name?: unknown;
  profile_id?: unknown;
  profile_handle?: unknown;
  page_followers?: unknown;
  following?: unknown;
  page_is_verified?: unknown;
  avatar_image_url?: unknown;
  page_intro?: unknown;
}

/**
 * Facebook has no dedicated "profile" scraper in Bright Data's API — the
 * page-level fields (name, followers, verified, avatar) ride along on every
 * post record from `posts_by_profile`, so fetching one post is the cheapest
 * way to get them. `profile_id` here is a real, stable numeric page ID —
 * Apify's own Facebook path has no such field (see apify/facebook/profile.ts).
 */
function mapFacebookRecord(item: BrightDataFacebookPostRecord | undefined): Profile | null {
  if (!item || typeof item.page_name !== "string") return null;

  const username = text(item.profile_handle) || item.page_name;
  const followerCount = num(item.page_followers);
  const followingCount = num(item.following);
  const noListCoverage = coverageFor(0, followerCount);

  return {
    id: `profile_facebook_${username}`,
    externalId: typeof item.profile_id === "string" ? item.profile_id : null,
    platform: "facebook",
    username,
    displayName: item.page_name,
    bio: text(item.page_intro),
    avatarUrl: text(item.avatar_image_url),
    isVerified: item.page_is_verified === true,
    isPrivate: false,
    followerCount,
    followingCount,
    postCount: 0,
    followerCoverage: noListCoverage,
    followingCoverage: coverageFor(0, followingCount),
  };
}

/**
 * Triggers a Bright Data job and schedules its completion to be polled and
 * cached in the background — never awaited by the caller. Any failure
 * (missing token, trigger error, timeout, unrecognized shape) is swallowed
 * here and only logged: a warm attempt that doesn't pan out must never
 * surface as an error, since the caller has already moved on.
 */
// Next.js renders a page's `generateMetadata` and the page body as separate
// passes that don't share React's request-scoped `cache()` memoization —
// confirmed live: a single page view triggered this function 3 times for
// the same profile. Since each trigger spends real Bright Data quota, this
// in-memory guard (per server instance, cleared once the job settles) keeps
// concurrent duplicate warms for the same platform+username down to one.
const inFlightWarms = new Set<string>();

function warmProfileInBackground(
  platform: Platform,
  datasetId: string,
  payload: Array<Record<string, unknown>>,
  usernameForCache: string,
  mapRecord: (item: unknown) => Profile | null,
  logLabel: string,
): void {
  const warmKey = `${platform}:${usernameForCache.toLowerCase()}`;
  if (inFlightWarms.has(warmKey)) return;
  inFlightWarms.add(warmKey);

  after(async () => {
    try {
      const snapshotId = await triggerBrightDataDataset(datasetId, payload);
      const records = await pollBrightDataSnapshot(snapshotId, { maxWaitMs: BACKGROUND_MAX_WAIT_MS });
      const profile = mapRecord(records[0]);
      if (!profile) {
        console.warn(`[brightdata] ${logLabel} returned an unrecognised shape for ${usernameForCache}`);
        return;
      }
      await writeCachedProfile(platform, usernameForCache, profile);
      console.log(`[brightdata] ${logLabel} warmed cache for ${usernameForCache}`);
    } catch (error) {
      const message = error instanceof BrightDataError ? error.message : String(error);
      console.warn(`[brightdata] ${logLabel} background warm failed for ${usernameForCache}: ${message}`);
    } finally {
      inFlightWarms.delete(warmKey);
    }
  });
}

/** Always returns `null` immediately — see the file header for why. */
export function warmBrightDataInstagramProfile(username: string): null {
  warmProfileInBackground(
    "instagram",
    INSTAGRAM_PROFILES_DATASET_ID,
    [{ url: `https://www.instagram.com/${username}/` }],
    username,
    (item) => mapInstagramRecord(item as BrightDataInstagramRecord | undefined),
    "instagram profile",
  );
  return null;
}

/** Always returns `null` immediately — see the file header for why. */
export function warmBrightDataFacebookProfile(usernameOrUrl: string): null {
  const url = usernameOrUrl.startsWith("http") ? usernameOrUrl : `https://www.facebook.com/${usernameOrUrl}`;
  warmProfileInBackground(
    "facebook",
    FACEBOOK_POSTS_BY_PROFILE_DATASET_ID,
    [{ url, num_of_posts: 1 }],
    usernameOrUrl,
    (item) => mapFacebookRecord(item as BrightDataFacebookPostRecord | undefined),
    "facebook profile",
  );
  return null;
}
