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
import type {
  Comment,
  CoverageStatus,
  CursorPage,
  Highlight,
  Liker,
  Post,
  Profile,
  SocialUser,
  Story,
  TaggedPost,
} from "@/lib/domain/types";
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

/** Deterministic placeholder image (picsum.photos supports a stable seed) — allowlisted by the media download route. */
function mockImageUrl(seed: string, size: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

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
    stories: true,
    highlights: true,
    taggedPosts: true,
    postEngagement: true,
    followers: true,
    following: true,
    followerHistory: false,
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
    const all: Post[] = Array.from({ length: total }, (_, i) => {
      const id = `${profileId}_post_${mediaType}_${i}`;
      // Deterministic placeholder image so viewing/downloading work end-to-end
      // in mock mode too — there's no real Instagram media without a real
      // provider, but the UI shouldn't be a wall of blank tiles either.
      const image = mockImageUrl(id, 600);
      return {
        id,
        profileId,
        mediaType: mediaType === "reel" ? "reel" : rand() > 0.7 ? "video" : "image",
        thumbnailUrl: image,
        mediaUrl: image,
        permalink: `https://www.instagram.com/p/mock_${id}/`,
        caption: "Post caption preview text goes here.",
        likeCount: Math.floor(rand() * 50_000),
        commentCount: Math.floor(rand() * 2_000),
        viewCount: mediaType === "reel" ? Math.floor(rand() * 1_000_000) : null,
        postedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      };
    });
    return paginate(all, cursor, limit);
  }

  async getStories(profileId: string): Promise<Story[]> {
    const rand = mulberry32(hashSeed(profileId + "stories"));
    // 0-4 active stories, deterministic per profile — some profiles
    // legitimately have none, same honesty the real provider gives.
    const count = Math.floor(rand() * 5);
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => {
      const id = `${profileId}_story_${i}`;
      const image = mockImageUrl(id, 800);
      const postedAt = now - i * 3 * 60 * 60 * 1000;
      return {
        id,
        profileId,
        mediaType: "image",
        mediaUrl: image,
        thumbnailUrl: image,
        postedAt: new Date(postedAt).toISOString(),
        expiresAt: new Date(postedAt + 24 * 60 * 60 * 1000).toISOString(),
      };
    });
  }

  async getHighlights(profileId: string): Promise<Highlight[]> {
    const rand = mulberry32(hashSeed(profileId + "highlights"));
    const count = Math.floor(rand() * 4); // 0-3 highlights, deterministic per profile
    const titles = ["Travel", "Behind the Scenes", "Q&A", "Launch Day", "Team"];
    return Array.from({ length: count }, (_, i) => {
      const id = `${profileId}_highlight_${i}`;
      const itemCount = 1 + Math.floor(rand() * 6);
      return {
        id,
        profileId,
        title: titles[i % titles.length],
        coverUrl: mockImageUrl(`${id}_cover`, 300),
        items: Array.from({ length: itemCount }, (_, j) => {
          const itemId = `${id}_item_${j}`;
          const image = mockImageUrl(itemId, 800);
          return {
            id: itemId,
            mediaType: "image" as const,
            mediaUrl: image,
            thumbnailUrl: image,
            postedAt: new Date(Date.now() - (i * itemCount + j) * 7 * 86_400_000).toISOString(),
          };
        }),
      };
    });
  }

  async getTaggedPosts(profileId: string): Promise<TaggedPost[]> {
    const rand = mulberry32(hashSeed(profileId + "tagged"));
    const count = Math.floor(rand() * 9); // 0-8, deterministic
    return Array.from({ length: count }, (_, i) => {
      const id = `${profileId}_tagged_${i}`;
      const image = mockImageUrl(id, 600);
      const authorId = `user_${Math.floor(rand() * 1e9).toString(36)}`;
      return {
        id,
        mediaType: "image" as const,
        mediaUrl: image,
        thumbnailUrl: image,
        permalink: `https://www.instagram.com/p/mock_${id}/`,
        caption: "Tagged post caption preview text.",
        likeCount: Math.floor(rand() * 20_000),
        commentCount: Math.floor(rand() * 500),
        postedAt: new Date(Date.now() - i * 3 * 86_400_000).toISOString(),
        authorUsername: authorId,
        authorAvatarUrl: mockImageUrl(`${authorId}_avatar`, 100),
        authorIsVerified: rand() > 0.8,
      };
    });
  }

  async getLikers(permalink: string, limit = 50): Promise<Liker[]> {
    const rand = mulberry32(hashSeed(permalink + "likers"));
    return Array.from({ length: limit }, (_, i) => {
      const uname = `user_${Math.floor(rand() * 1e9).toString(36)}`;
      return {
        username: uname,
        displayName: uname,
        avatarUrl: mockImageUrl(`${permalink}_liker_${i}`, 100),
        isVerified: rand() > 0.95,
        isPrivate: rand() > 0.7,
      };
    });
  }

  async getComments(permalink: string, limit = 30): Promise<Comment[]> {
    const rand = mulberry32(hashSeed(permalink + "comments"));
    const sample = ["Love this! ❤️", "🔥🔥🔥", "Amazing shot", "Where is this?", "So good", "😍😍😍", "Incredible!"];
    return Array.from({ length: limit }, (_, i) => {
      const uname = `user_${Math.floor(rand() * 1e9).toString(36)}`;
      return {
        id: `${permalink}_comment_${i}`,
        authorUsername: uname,
        authorAvatarUrl: mockImageUrl(`${permalink}_commenter_${i}`, 100),
        authorIsVerified: rand() > 0.95,
        text: sample[Math.floor(rand() * sample.length)],
        likeCount: Math.floor(rand() * 200),
        postedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
      };
    });
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
}

export const mockProvider = new MockSocialDataProvider();
