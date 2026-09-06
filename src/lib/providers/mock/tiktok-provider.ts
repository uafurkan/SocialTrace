/**
 * Deterministic mock TikTok provider — same seeded-random approach as
 * ../mock-provider.ts, trimmed to the capabilities TikTok actually has
 * (see ../apify/tiktok/index.ts's capabilities flags).
 */
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

const MEMBER_CAP = 200;

function profileFor(username: string): Profile {
  if (NOT_FOUND_USERNAMES.has(username.toLowerCase())) {
    throw new ProfileNotFoundError(username);
  }
  const rand = mulberry32(hashSeed(`tiktok:${username.toLowerCase()}`));
  const followerCount = Math.floor(rand() * 500_000);
  const followingCount = Math.floor(rand() * 500);
  return {
    id: `profile_tiktok_${username}`,
    platform: "tiktok",
    username,
    displayName: username,
    bio: "Mock TikTok bio for local development.",
    avatarUrl: mockImageUrl(`tiktok-${username}`, 200),
    isVerified: rand() > 0.85,
    isPrivate: false,
    followerCount,
    followingCount,
    postCount: Math.floor(rand() * 500),
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_CAP), followingCount),
  };
}

function postsFor(username: string, profileId: string, count: number): Post[] {
  const rand = mulberry32(hashSeed(`tiktok-posts:${username.toLowerCase()}`));
  return Array.from({ length: count }, (_, i) => ({
    id: `${profileId}_post_${i}`,
    profileId,
    mediaType: "video" as const,
    thumbnailUrl: mockImageUrl(`tiktok-${username}-${i}`, 400),
    mediaUrl: mockImageUrl(`tiktok-${username}-${i}`, 800),
    permalink: `https://www.tiktok.com/@${username}/video/${1000 + i}`,
    caption: `Mock TikTok video #${i + 1}`,
    likeCount: Math.floor(rand() * 50_000),
    commentCount: Math.floor(rand() * 2_000),
    viewCount: Math.floor(rand() * 1_000_000),
    postedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
}

function membersFor(username: string, kind: "followers" | "following", count: number): SocialUser[] {
  const rand = mulberry32(hashSeed(`tiktok-${kind}:${username.toLowerCase()}`));
  return Array.from({ length: count }, (_, i) => ({
    id: `tiktok_user_${username}_${kind}_${i}`,
    platform: "tiktok" as const,
    username: `${kind}_${i}_${username}`,
    displayName: `Mock ${kind} ${i}`,
    avatarUrl: mockImageUrl(`tiktok-${username}-${kind}-${i}`, 100),
    isVerified: rand() > 0.9,
  }));
}

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_tiktok_/, "");
}

class MockTikTokProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: false,
    stories: false,
    highlights: false,
    taggedPosts: false,
    postEngagement: false,
    followers: true,
    following: true,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: profileFor(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    return paginate(postsFor(username, profileId, MEMBER_CAP), cursor, limit);
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

  async getFollowers(profileId: string, cursor?: string, limit = 100, query?: string): Promise<CursorPage<SocialUser>> {
    const username = usernameFromProfileId(profileId);
    const all = membersFor(username, "followers", MEMBER_CAP);
    const filtered = query ? all.filter((u) => u.username.toLowerCase().includes(query.toLowerCase())) : all;
    return paginate(filtered, cursor, limit);
  }

  async getFollowing(profileId: string, cursor?: string, limit = 100, query?: string): Promise<CursorPage<SocialUser>> {
    const username = usernameFromProfileId(profileId);
    const all = membersFor(username, "following", MEMBER_CAP);
    const filtered = query ? all.filter((u) => u.username.toLowerCase().includes(query.toLowerCase())) : all;
    return paginate(filtered, cursor, limit);
  }
}

export const mockTikTokProvider = new MockTikTokProvider();
