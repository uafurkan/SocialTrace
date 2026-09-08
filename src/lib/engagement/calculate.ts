import type { Platform } from "@/lib/domain/types";
import { getCachedProfile } from "@/lib/cache/profile-cache";
import { collectPages } from "@/lib/providers/collect";
import { getProvider } from "@/lib/providers";
import { ProfileNotFoundError } from "@/lib/providers/types";

/** How many recent posts are sampled — matches the sample size competitor engagement calculators (Hootsuite, Modash) disclose for their own tools. */
const SAMPLE_SIZE = 12;

export type EngagementErrorReason = "profile_not_found" | "private_account" | "no_posts" | "source_unavailable";

export class EngagementError extends Error {
  constructor(
    public reason: EngagementErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "EngagementError";
  }
}

export interface EngagementResult {
  platform: Platform;
  username: string;
  followerCount: number;
  requestedSampleSize: number;
  sampleSize: number;
  avgLikes: number;
  avgComments: number;
  engagementRatePercent: number;
  perPost: Array<{ id: string; likeCount: number; commentCount: number; postedAt: string }>;
}

/** Anything that isn't a statement about the profile itself is a source failure — surfaced as a retryable 503 rather than a generic 502 that reads as "this profile is broken". */
function asEngagementError(error: unknown, platform: Platform, username: string): EngagementError {
  if (error instanceof ProfileNotFoundError) {
    return new EngagementError("profile_not_found", `No public ${platform} profile found for "${username}".`);
  }
  if (error instanceof EngagementError) return error;
  return new EngagementError(
    "source_unavailable",
    "We couldn't reach the data source for this profile right now. Please try again shortly.",
  );
}

export async function calculateEngagement(platform: Platform, username: string): Promise<EngagementResult> {
  const provider = getProvider(platform);

  // Goes through the cache rather than straight to the provider: this used to
  // re-fetch on every calculation, so two visitors checking the same profile
  // paid for it twice. The cache also carries the last-known-good fallback, so
  // a provider outage degrades to slightly stale numbers instead of an error.
  let profileResult;
  try {
    profileResult = platform === "instagram" ? await getCachedProfile(username, platform) : await provider.getProfile(username);
  } catch (error) {
    throw asEngagementError(error, platform, username);
  }
  const { profile } = profileResult;

  if (profile.isPrivate) {
    throw new EngagementError("private_account", "This account is private — engagement can't be calculated from a private profile.");
  }

  let posts;
  try {
    posts = await collectPages((cursor) => provider.getPosts(profile.id, cursor), SAMPLE_SIZE);
  } catch (error) {
    throw asEngagementError(error, platform, username);
  }
  if (posts.length === 0) {
    throw new EngagementError("no_posts", "This profile has no public posts to sample.");
  }

  const totalLikes = posts.reduce((sum, post) => sum + post.likeCount, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.commentCount, 0);
  const avgLikes = totalLikes / posts.length;
  const avgComments = totalComments / posts.length;
  const engagementRatePercent = profile.followerCount > 0 ? ((avgLikes + avgComments) / profile.followerCount) * 100 : 0;

  return {
    platform,
    username: profile.username,
    followerCount: profile.followerCount,
    requestedSampleSize: SAMPLE_SIZE,
    sampleSize: posts.length,
    avgLikes,
    avgComments,
    engagementRatePercent,
    perPost: posts.map((post) => ({ id: post.id, likeCount: post.likeCount, commentCount: post.commentCount, postedAt: post.postedAt })),
  };
}
