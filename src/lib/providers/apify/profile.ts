import type { Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";
import { runApifyActor } from "./client";

const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";

// Re-exported so existing importers (apify/index.ts) keep their import path.
export { MEMBER_FETCH_CAP };

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

/**
 * The single source for this path: the Apify actor. The earlier undocumented
 * web endpoint was removed, and so was the fallback that fired a second
 * vendor (Bright Data) when the first source refused. Moving on to another
 * source after a block is the bypass this project does not do.
 *
 * `ProfileNotFoundError` is a confirmed "no such user" answer, so it is thrown
 * as is and never retried.
 */
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
    externalId: item.id ?? null,
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
