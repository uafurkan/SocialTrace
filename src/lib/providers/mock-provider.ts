/**
 * Deterministic mock implementation of SocialDataProvider (spec §34).
 * No real Instagram integration exists yet (see docs/DECISIONS.md) — this
 * generates seeded-random fake data so the same username always returns
 * the same profile/followers, keeping UI and future tests reproducible.
 *
 * `nike` is seeded as a large, low-coverage profile, `smallcreator` as a
 * mid-size one whose real follower count still exceeds the snapshot
 * engine's per-capture cap (see src/lib/snapshot/capture.ts), and
 * `tinytest` as a genuinely small profile fully within that cap — the one
 * seed where a captured snapshot reaches near-100% coverage, which is
 * what the diff engine (src/lib/diff/) requires before it will compute
 * added/removed members at all (spec §20).
 */
import type { CoverageStatus, CursorPage, Post, Profile, SocialUser } from "@/lib/domain/types";
import { paginate } from "./paginate";
import { ProfileNotFoundError, type ProviderCapabilities, type SocialDataProvider } from "./types";

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

interface SeedProfile {
  username: string;
  displayName: string;
  bio: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  indexedFollowers: number;
}

const SEED_PROFILES: Record<string, SeedProfile> = {
  nike: {
    username: "nike",
    displayName: "Nike",
    bio: "Sportswear, footwear and equipment for every kind of athlete.",
    isVerified: true,
    followerCount: 312_482_913,
    followingCount: 421,
    postCount: 8_421,
    indexedFollowers: 79_842, // ~0.03% — deliberately low coverage for a huge account
  },
  smallcreator: {
    username: "smallcreator",
    displayName: "Small Creator",
    bio: "Founder @company | Building in public.",
    isVerified: false,
    followerCount: 42_183,
    followingCount: 892,
    postCount: 214,
    indexedFollowers: 42_183, // fully indexed — small profile
  },
  tinytest: {
    username: "tinytest",
    displayName: "Tiny Test",
    bio: "A small account used to exercise near-100%-coverage code paths.",
    isVerified: false,
    followerCount: 180,
    followingCount: 95,
    postCount: 12,
    indexedFollowers: 180, // fully indexed and within SNAPSHOT_MEMBER_LIMIT
  },
};

function seedProfileFor(username: string): SeedProfile {
  const known = SEED_PROFILES[username.toLowerCase()];
  if (known) return known;

  const rand = mulberry32(hashSeed(username.toLowerCase()));
  const followerCount = Math.floor(rand() * 500_000) + 500;
  const coverageRatio = followerCount > 100_000 ? rand() * 0.15 : Math.min(1, 0.4 + rand() * 0.6);
  return {
    username,
    displayName: username
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    bio: "Public profile.",
    isVerified: rand() > 0.85,
    followerCount,
    followingCount: Math.floor(rand() * 2000) + 10,
    postCount: Math.floor(rand() * 1000),
    indexedFollowers: Math.max(1, Math.floor(followerCount * coverageRatio)),
  };
}

function coverageFor(indexed: number, total: number): CoverageStatus {
  const raw = total === 0 ? 0 : (indexed / total) * 100;
  // Adaptive precision: a tiny non-zero coverage (e.g. 0.03%) must never
  // round down to a literal "0%" — that reads as no data at all (spec §1.2).
  const coveragePercent = raw === 0 ? 0 : raw < 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10) / 10;
  return {
    status: coveragePercent >= 99.5 ? "available" : indexed > 0 ? "partial" : "unavailable",
    coveragePercent,
    indexedCount: indexed,
    totalCount: total,
    lastCheckedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  };
}

function toProfile(seed: SeedProfile): Profile {
  return {
    id: `profile_${seed.username}`,
    platform: "instagram",
    username: seed.username,
    displayName: seed.displayName,
    bio: seed.bio,
    avatarUrl: "",
    isVerified: seed.isVerified,
    isPrivate: false,
    followerCount: seed.followerCount,
    followingCount: seed.followingCount,
    postCount: seed.postCount,
    followerCoverage: coverageFor(seed.indexedFollowers, seed.followerCount),
    followingCoverage: coverageFor(seed.followingCount, seed.followingCount),
  };
}

function generateSocialUsers(profileId: string, count: number, rand: () => number): SocialUser[] {
  const users: SocialUser[] = [];
  for (let i = 0; i < count; i++) {
    const uname = `user_${Math.floor(rand() * 1e9).toString(36)}`;
    users.push({
      id: `${profileId}_su_${i}_${uname}`,
      platform: "instagram",
      username: uname,
      displayName: uname,
      avatarUrl: "",
      isVerified: rand() > 0.97,
    });
  }
  return users;
}

export class MockSocialDataProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: true,
    stories: false,
    highlights: false,
    followers: true,
    following: true,
    followerHistory: false,
    userSearch: true,
  };

  async getProfile(username: string) {
    if (NOT_FOUND_USERNAMES.has(username.toLowerCase())) {
      throw new ProfileNotFoundError(username);
    }
    return { profile: toProfile(seedProfileFor(username)) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24) {
    return this.buildPosts(profileId, "image", cursor, limit);
  }

  async getReels(profileId: string, cursor?: string, limit = 24) {
    return this.buildPosts(profileId, "reel", cursor, limit);
  }

  private buildPosts(profileId: string, mediaType: Post["mediaType"], cursor: string | undefined, limit: number): CursorPage<Post> {
    const rand = mulberry32(hashSeed(profileId + mediaType));
    const total = mediaType === "reel" ? 40 : 120;
    const all: Post[] = Array.from({ length: total }, (_, i) => ({
      id: `${profileId}_post_${mediaType}_${i}`,
      profileId,
      mediaType: mediaType === "reel" ? "reel" : rand() > 0.7 ? "video" : "image",
      thumbnailUrl: "",
      caption: "Post caption preview text goes here.",
      likeCount: Math.floor(rand() * 50_000),
      commentCount: Math.floor(rand() * 2_000),
      viewCount: mediaType === "reel" ? Math.floor(rand() * 1_000_000) : null,
      postedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
    return paginate(all, cursor, limit);
  }

  async getFollowers(profileId: string, cursor?: string, limit = 100, query?: string) {
    return this.buildMembers(profileId, "followers", cursor, limit, query);
  }

  async getFollowing(profileId: string, cursor?: string, limit = 100, query?: string) {
    return this.buildMembers(profileId, "following", cursor, limit, query);
  }

  private buildMembers(
    profileId: string,
    kind: "followers" | "following",
    cursor: string | undefined,
    limit: number,
    query?: string,
  ): CursorPage<SocialUser> {
    const usernameOnly = profileId.replace(/^profile_/, "");
    const seed = seedProfileFor(usernameOnly);
    const count = kind === "followers" ? seed.indexedFollowers : seed.followingCount;
    const rand = mulberry32(hashSeed(profileId + kind));
    const cappedCount = Math.min(count, 5000); // in-memory mock cap; real dataset size stays in coverage numbers
    const all = generateSocialUsers(profileId, cappedCount, rand);

    const filtered = query
      ? all.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()))
      : all;

    return paginate(filtered, cursor, limit);
  }

  async searchUsers(query: string, limit = 8): Promise<SocialUser[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const seeded = Object.keys(SEED_PROFILES).filter((u) => u.includes(trimmed));
    const rand = mulberry32(hashSeed(trimmed));
    const synthetic = Array.from({ length: 5 }, () => `${trimmed}${Math.floor(rand() * 900 + 100)}`);
    const candidates = [...new Set([...seeded, trimmed, ...synthetic])];

    return rankByRelevance(candidates, trimmed)
      .slice(0, limit)
      .map((username) => {
        const seed = seedProfileFor(username);
        return {
          id: `mock_${username}`,
          platform: "instagram",
          username,
          displayName: seed.displayName,
          avatarUrl: "",
          isVerified: seed.isVerified,
        };
      });
  }
}

/** Exact match first, then startsWith, then includes — same ranking the real search uses. */
function rankByRelevance(usernames: string[], query: string): string[] {
  return [...usernames].sort((a, b) => rankOf(a, query) - rankOf(b, query) || a.localeCompare(b));
}

function rankOf(username: string, query: string): number {
  if (username === query) return 0;
  if (username.startsWith(query)) return 1;
  if (username.includes(query)) return 2;
  return 3;
}

export const mockProvider = new MockSocialDataProvider();
