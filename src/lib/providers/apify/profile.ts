import type { Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";
import { fetchWebProfileInfo, toProfile } from "../instagram-public/web-profile-info";
import { warmBrightDataInstagramProfile } from "../brightdata/profile";
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
 * Source chain: the free public endpoint first, the paid Apify actor
 * second. Bright Data (an independent vendor/quota — see
 * providers/brightdata/client.ts) is *not* in this synchronous chain —
 * live testing found its completion time too slow and variable to block a
 * request on (confirmed ~50s-plus, sometimes not ready at all within that).
 * Instead, whenever this falls through past the free source,
 * `warmBrightDataInstagramProfile` fires a background job that writes
 * straight into the profile cache when it finishes, so a *later* visit to
 * this same profile can get a fast cache hit even while Apify is out —
 * without ever making the visitor waiting right now sit through it.
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

  warmBrightDataInstagramProfile(username);

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
