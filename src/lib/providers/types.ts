/**
 * Provider abstraction (spec §34). Business logic and UI must depend only
 * on this interface, never on a specific acquisition provider — see
 * spec §1.3 and docs/PROVIDER_CONTRACT.md.
 */
import type { CursorPage, Post, Profile, SocialUser, Story } from "@/lib/domain/types";

export interface ProviderCapabilities {
  profile: boolean;
  posts: boolean;
  reels: boolean;
  stories: boolean;
  highlights: boolean;
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
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
}
