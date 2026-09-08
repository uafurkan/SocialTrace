import type { Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";
import { fetchWebProfileInfo, toProfile } from "../instagram-public/web-profile-info";
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
 * Source chain: the free public endpoint first, the paid actor second.
 *
 * Free-first is both cheaper and faster (~300ms vs. a billed ~10s actor run),
 * and it means an exhausted Apify quota or a failing actor no longer takes
 * profile lookups down with it. The free source returns `null` — never a
 * partial result — when it can't answer, so a fall-through is always safe.
 *
 * `ProfileNotFoundError` propagates instead of falling through: a confirmed
 * "no such user" is an answer, and retrying it against a paid actor would burn
 * a billed call to be told the same thing.
 */
export async function fetchApifyProfile(username: string): Promise<Profile> {
  const publicUser = await fetchWebProfileInfo(username);
  if (publicUser) {
    return toProfile(publicUser);
  }

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
