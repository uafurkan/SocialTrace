import type { CoverageStatus, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../../types";
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
 */
export async function fetchApifyFacebookProfile(usernameOrUrl: string): Promise<Profile> {
  const url = usernameOrUrl.startsWith("http") ? usernameOrUrl : `https://www.facebook.com/${usernameOrUrl}`;
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
    id: `profile_facebook_${item.pageName}`,
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
