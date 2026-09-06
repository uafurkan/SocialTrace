/** Deterministic mock Facebook provider — see ../mock/tiktok-provider.ts for the same pattern. */
import type { Comment, CoverageStatus, CursorPage, Highlight, Liker, Post, Profile, SocialUser, Story, TaggedPost } from "@/lib/domain/types";
import { paginate } from "../paginate";
import { ProfileNotFoundError, type ProviderCapabilities, type SocialDataProvider } from "../types";

function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOT_FOUND_USERNAMES = new Set(["doesnotexist", "notfound"]);

function mockImageUrl(seed: string, size: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

const unavailableCoverage = (total: number): CoverageStatus => ({
  status: "unavailable",
  coveragePercent: 0,
  indexedCount: 0,
  totalCount: total,
  lastCheckedAt: new Date().toISOString(),
});

function profileFor(username: string): Profile {
  if (NOT_FOUND_USERNAMES.has(username.toLowerCase())) {
    throw new ProfileNotFoundError(username);
  }
  const rand = mulberry32(hashSeed(`facebook:${username.toLowerCase()}`));
  const followerCount = Math.floor(rand() * 2_000_000);
  return {
    id: `profile_facebook_${username}`,
    platform: "facebook",
    username,
    displayName: username,
    bio: "",
    avatarUrl: mockImageUrl(`facebook-${username}`, 200),
    isVerified: false,
    isPrivate: false,
    followerCount,
    followingCount: Math.floor(rand() * 50),
    postCount: 0,
    followerCoverage: unavailableCoverage(followerCount),
    followingCoverage: unavailableCoverage(0),
  };
}

function postsFor(username: string, profileId: string, count: number): Post[] {
  const rand = mulberry32(hashSeed(`facebook-posts:${username.toLowerCase()}`));
  return Array.from({ length: count }, (_, i) => ({
    id: `${profileId}_post_${i}`,
    profileId,
    mediaType: i % 3 === 0 ? ("video" as const) : ("image" as const),
    thumbnailUrl: mockImageUrl(`facebook-${username}-${i}`, 400),
    mediaUrl: `https://www.facebook.com/${username}/posts/${1000 + i}`,
    permalink: `https://www.facebook.com/${username}/posts/${1000 + i}`,
    caption: `Mock Facebook post #${i + 1}`,
    likeCount: Math.floor(rand() * 20_000),
    commentCount: Math.floor(rand() * 1_000),
    viewCount: i % 3 === 0 ? Math.floor(rand() * 500_000) : null,
    postedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
}

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_facebook_/, "");
}

class MockFacebookProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: false,
    stories: false,
    highlights: false,
    taggedPosts: false,
    postEngagement: false,
    followers: false,
    following: false,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: profileFor(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    return paginate(postsFor(username, profileId, 60), cursor, limit);
  }

  async getReels(): Promise<CursorPage<Post>> {
    return { items: [], nextCursor: null, totalCount: 0 };
  }

  async getStories(): Promise<Story[]> {
    return [];
  }

  async getHighlights(): Promise<Highlight[]> {
    return [];
  }

  async getTaggedPosts(): Promise<TaggedPost[]> {
    return [];
  }

  async getLikers(): Promise<Liker[]> {
    return [];
  }

  async getComments(): Promise<Comment[]> {
    return [];
  }

  async getFollowers(): Promise<CursorPage<SocialUser>> {
    throw new Error("Facebook Pages don't expose a follower list — see docs/PROVIDER_CONTRACT.md.");
  }

  async getFollowing(): Promise<CursorPage<SocialUser>> {
    throw new Error("Facebook Pages don't expose a following list — see docs/PROVIDER_CONTRACT.md.");
  }
}

export const mockFacebookProvider = new MockFacebookProvider();
