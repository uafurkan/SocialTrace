/**
 * Provider abstraction (spec §34). Business logic and UI must depend only
 * on this interface, never on a specific acquisition provider — see
 * spec §1.3 and docs/PROVIDER_CONTRACT.md.
 */
import type { CursorPage, Post, Profile, SocialUser } from "@/lib/domain/types";

export interface ProviderCapabilities {
  profile: boolean;
  posts: boolean;
  reels: boolean;
  stories: boolean;
  highlights: boolean;
  followers: boolean;
  following: boolean;
  followerHistory: boolean;
  /** Username search-as-you-type suggestions (spec-adjacent, added for the homepage search box). */
  userSearch: boolean;
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
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  /** Username search-as-you-type suggestions, ranked closest-match first. Not paginated — small top-N list. */
  searchUsers(query: string, limit?: number): Promise<SocialUser[]>;
}
