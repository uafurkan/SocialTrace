import type { CoverageStatus, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { runApifyActor } from "./client";

const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";

/**
 * Upper bound on how many followers/following this integration will ever
 * pull for one profile (see followers.ts). Coverage here is computed
 * against that cap, not a live count — see docs/PROVIDER_CONTRACT.md for
 * why calling a follower-scraper actor on every profile view is too
 * expensive to do eagerly.
 */
export const MEMBER_FETCH_CAP = 200;

interface ApifyProfileItem {
  id: string;
  username: string;
  fullName?: string;
  biography?: string;
  profilePicUrl?: string;
  verified?: boolean;
  private?: boolean;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
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

export async function fetchApifyProfile(username: string): Promise<Profile> {
  const items = (await runApifyActor(PROFILE_ACTOR_ID, { usernames: [username] })) as ApifyProfileItem[];
  const item = Array.isArray(items) ? items[0] : undefined;

  if (!item || !item.username) {
    throw new ProfileNotFoundError(username);
  }

  const followerCount = item.followersCount ?? 0;
  const followingCount = item.followsCount ?? 0;

  return {
    id: `profile_${item.username}`,
    platform: "instagram",
    username: item.username,
    displayName: item.fullName || item.username,
    bio: item.biography ?? "",
    avatarUrl: item.profilePicUrl ?? "",
    isVerified: item.verified ?? false,
    isPrivate: item.private ?? false,
    followerCount,
    followingCount,
    postCount: item.postsCount ?? 0,
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_FETCH_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_FETCH_CAP), followingCount),
  };
}
