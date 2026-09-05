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
