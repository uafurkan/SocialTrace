import type { CoverageStatus, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../../types";
import { runApifyActor } from "../client";

const PROFILE_ACTOR_ID = "clockworks~tiktok-profile-scraper";

/** Same reasoning as the Instagram provider's MEMBER_FETCH_CAP — see profile.ts there. */
export const MEMBER_FETCH_CAP = 200;

interface TikTokAuthorMeta {
  id: string;
  name: string;
  nickName?: string;
  signature?: string;
  avatar?: string;
  verified?: boolean;
  privateAccount?: boolean;
  fans?: number;
  following?: number;
  video?: number;
}

interface TikTokProfileItem {
  authorMeta?: TikTokAuthorMeta;
}

function coverageFor(indexed: number, total: number): CoverageStatus {
  const raw = total === 0 ? 0 : (indexed / total) * 100;
  const coveragePercent = raw === 0 ? 0 : raw < 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10) / 10;
  return {
    status: coveragePercent >= 99.5 ? "available" : indexed > 0 ? "partial" : "unavailable",
    coveragePercent,
    indexedCount: indexed,
    totalCount: total,
    lastCheckedAt: new Date().toISOString(),
  };
}

/**
 * One item is enough to read `authorMeta` off of — `resultsPerPage: 1`
 * keeps this call cheap; `getPosts` (posts.ts) makes its own separate call
 * for the actual video list, matching how the Instagram provider keeps
 * profile and posts as independently-cacheable fetches.
 */
export async function fetchApifyTikTokProfile(username: string): Promise<Profile> {
  const items = (await runApifyActor(PROFILE_ACTOR_ID, {
    profiles: [username],
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  })) as TikTokProfileItem[];

  const author = Array.isArray(items) ? items[0]?.authorMeta : undefined;
  if (!author || !author.name) {
    throw new ProfileNotFoundError(username);
  }

  const followerCount = author.fans ?? 0;
  const followingCount = author.following ?? 0;

  return {
    id: `profile_tiktok_${author.name}`,
    platform: "tiktok",
    username: author.name,
    displayName: author.nickName || author.name,
    bio: author.signature ?? "",
    avatarUrl: author.avatar ?? "",
    isVerified: author.verified ?? false,
    isPrivate: author.privateAccount ?? false,
    followerCount,
    followingCount,
    postCount: author.video ?? 0,
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_FETCH_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_FETCH_CAP), followingCount),
  };
}
