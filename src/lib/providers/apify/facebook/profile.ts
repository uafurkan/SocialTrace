import type { CoverageStatus, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../../types";
import { warmBrightDataFacebookProfile } from "../../brightdata/profile";
import { runApifyActor } from "../client";

const PAGE_ACTOR_ID = "apify~facebook-pages-scraper";

interface FacebookPageItem {
  pageName?: string;
  title?: string;
  profilePictureUrl?: string;
  followers?: number;
  followings?: number;
  likes?: number;
}

/**
 * Facebook Pages are always public by definition — there's no private/
 * public toggle to read the way Instagram/TikTok accounts have, so
 * isPrivate is always false here (honest, not a guess).
 *
 * Bright Data (an independent vendor/quota — see providers/brightdata/client.ts)
 * is not called synchronously here for the same reason as the Instagram
 * fetcher: its confirmed live latency (~66s, sometimes more) is too slow and
 * variable to block a request on. `warmBrightDataFacebookProfile` instead
 * fires a background job that writes into the profile cache when it
 * finishes, warming the *next* visit to this page without making the
 * current visitor wait for it.
 */
export async function fetchApifyFacebookProfile(usernameOrUrl: string): Promise<Profile> {
  const url = usernameOrUrl.startsWith("http") ? usernameOrUrl : `https://www.facebook.com/${usernameOrUrl}`;

  warmBrightDataFacebookProfile(url);

  const items = (await runApifyActor(PAGE_ACTOR_ID, { startUrls: [{ url }] })) as FacebookPageItem[];
  const item = Array.isArray(items) ? items[0] : undefined;

  if (!item || !item.pageName) {
    throw new ProfileNotFoundError(usernameOrUrl);
  }

  const followerCount = item.followers ?? item.likes ?? 0;
  const followingCount = item.followings ?? 0;

  // No follower/following LIST actor exists for Facebook Pages (Meta
  // doesn't expose one publicly) — coverage is always 0 indexed, honestly
  // reflecting that this count is real but the underlying list isn't
  // fetchable at all, not merely partial (see index.ts's capabilities).
  const noListCoverage: CoverageStatus = {
    status: "unavailable",
    coveragePercent: 0,
    indexedCount: 0,
    totalCount: followerCount,
    lastCheckedAt: new Date().toISOString(),
  };

  return {
    // No stable numeric page ID field is present in apify~facebook-pages-scraper's
    // response shape (see docs/DECISIONS.md) — null is the honest value here,
    // never a hash of the username (that would silently recreate the exact
    // rename-tracking bug this field exists to fix).
    id: `profile_facebook_${item.pageName}`,
    externalId: null,
    platform: "facebook",
    username: item.pageName,
    displayName: item.title || item.pageName,
    bio: "",
    avatarUrl: item.profilePictureUrl ?? "",
    isVerified: false,
    isPrivate: false,
    followerCount,
    followingCount,
    postCount: 0,
    followerCoverage: noListCoverage,
    followingCoverage: { ...noListCoverage, totalCount: followingCount },
  };
}
