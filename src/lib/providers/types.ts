/**
 * Provider abstraction (spec §34). Business logic and UI must depend only
 * on this interface, never on a specific acquisition provider — see
 * spec §1.3 and docs/PROVIDER_CONTRACT.md.
 */
import type { Comment, CursorPage, Highlight, Liker, Post, Profile, SocialUser, Story, TaggedPost } from "@/lib/domain/types";

export interface ProviderCapabilities {
  profile: boolean;
  posts: boolean;
  reels: boolean;
  stories: boolean;
  highlights: boolean;
  taggedPosts: boolean;
  postEngagement: boolean;
  followers: boolean;
  following: boolean;
  followerHistory: boolean;
}

export interface ProviderProfileResult {
  profile: Profile;
}

export class ProfileNotFoundError extends Error {
  constructor(username: string) {
    super(`Profile not found: ${username}`);
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Every source for this data failed — an exhausted provider quota, an actor
 * outage, a network failure — and no cached copy exists to fall back on.
 *
 * Deliberately distinct from `ProfileNotFoundError`, because conflating them
 * tells a visitor their profile doesn't exist when the truth is that we
 * briefly can't reach it. That's not a wording nitpick: "no such profile" is a
 * statement about *their* account that a visitor may act on, while this is a
 * statement about *us*. Routes map this to 503 (temporary, retry later), not
 * 404 or 502.
 */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly resource: string,
    cause?: unknown,
  ) {
    super(`Provider unavailable for ${resource}`);
    this.name = "ProviderUnavailableError";
    this.cause = cause;
  }
}

export interface SocialDataProvider {
  readonly capabilities: ProviderCapabilities;
  getProfile(username: string): Promise<ProviderProfileResult>;
  getPosts(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  getReels(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  /** Currently-active (unexpired) stories only — no pagination, IG stories are naturally few and ephemeral. */
  getStories(profileId: string): Promise<Story[]>;
  /** Saved highlight reels and their contained media — no pagination, a profile realistically has a handful of these. */
  getHighlights(profileId: string): Promise<Highlight[]>;
  /** Posts/reels this profile was tagged in by other accounts — no pagination. */
  getTaggedPosts(profileId: string): Promise<TaggedPost[]>;
  /** Who liked a specific post/reel — takes the post's own permalink, not an internal profileId. */
  getLikers(permalink: string, limit?: number): Promise<Liker[]>;
  /** Comments on a specific post/reel — takes the post's own permalink, not an internal profileId. */
  getComments(permalink: string, limit?: number): Promise<Comment[]>;
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
}
