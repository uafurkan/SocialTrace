import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Post, Profile } from "@/lib/domain/types";

const { getCachedProfile, getPosts } = vi.hoisted(() => ({
  getCachedProfile: vi.fn(),
  getPosts: vi.fn(),
}));

vi.mock("@/lib/cache/profile-cache", () => ({ getCachedProfile }));
vi.mock("@/lib/providers", () => ({ getProvider: () => ({ getPosts }) }));

import { calculateEngagement, EngagementError } from "./calculate";

const FOLLOWERS = 1000;

function profile(): Profile {
  const coverage = { status: "available" as const, coveragePercent: 100, indexedCount: 0, totalCount: 0, lastCheckedAt: "2026-01-01T00:00:00.000Z" };
  return {
    id: "ig-1",
    externalId: "1",
    platform: "instagram",
    username: "brand",
    displayName: "Brand",
    bio: "",
    avatarUrl: "",
    isVerified: false,
    isPrivate: false,
    followerCount: FOLLOWERS,
    followingCount: 0,
    postCount: 0,
    followerCoverage: coverage,
    followingCoverage: coverage,
  };
}

function post(id: string, likeCount: number, commentCount: number): Post {
  return {
    id,
    profileId: "ig-1",
    mediaType: "image",
    thumbnailUrl: "",
    mediaUrl: "",
    permalink: `https://www.instagram.com/p/${id}/`,
    caption: "",
    likeCount,
    commentCount,
    viewCount: null,
    postedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Three readable posts with per-post rates of 11%, 5% and 24% on 1,000 followers. */
const READABLE = [post("a", 100, 10), post("b", 50, 0), post("c", 200, 40)];

function usePosts(posts: Post[]) {
  getPosts.mockResolvedValue({ items: posts, nextCursor: null, totalCount: posts.length });
}

describe("calculateEngagement", () => {
  beforeEach(() => {
    getCachedProfile.mockReset();
    getPosts.mockReset();
    getCachedProfile.mockResolvedValue({ profile: profile() });
  });

  it("averages and takes the median over every post when all counts are readable", async () => {
    usePosts(READABLE);

    const result = await calculateEngagement("instagram", "brand");

    expect(result.sampleSize).toBe(3);
    expect(result.medianSampleSize).toBe(3);
    expect(result.requestedSampleSize).toBe(12);
    expect(result.medianEngagementRatePercent).toBeCloseTo(11, 10);
    expect(result.engagementRatePercent).toBeCloseTo(40 / 3, 10);
    expect(result.avgLikes).toBeCloseTo(350 / 3, 10);
    expect(result.avgComments).toBeCloseTo(50 / 3, 10);
  });

  it("leaves a post with an undefined like count out of the mean, the median and the sample size", async () => {
    const unreadable = { ...post("d", 0, 5), likeCount: undefined as unknown as number };
    usePosts([...READABLE, unreadable]);

    const result = await calculateEngagement("instagram", "brand");

    expect(result.sampleSize).toBe(3);
    expect(result.medianSampleSize).toBe(3);
    expect(result.medianEngagementRatePercent).toBeCloseTo(11, 10);
    expect(result.engagementRatePercent).toBeCloseTo(40 / 3, 10);
    expect(result.avgLikes).toBeCloseTo(350 / 3, 10);
    expect(result.avgComments).toBeCloseTo(50 / 3, 10);
    expect(Number.isNaN(result.avgLikes)).toBe(false);
  });

  it("leaves out posts whose comment count is NaN or infinite", async () => {
    const nanComments = post("e", 7, Number.NaN);
    const infiniteLikes = post("f", Number.POSITIVE_INFINITY, 3);
    usePosts([...READABLE, nanComments, infiniteLikes]);

    const result = await calculateEngagement("instagram", "brand");

    expect(result.sampleSize).toBe(3);
    expect(result.medianSampleSize).toBe(3);
    expect(result.medianEngagementRatePercent).toBeCloseTo(11, 10);
    expect(result.engagementRatePercent).toBeCloseTo(40 / 3, 10);
    expect(result.avgComments).toBeCloseTo(50 / 3, 10);
  });

  it("lists only the posts the figures were computed from in perPost", async () => {
    const unreadable = { ...post("d", 0, 5), likeCount: undefined as unknown as number };
    usePosts([...READABLE, unreadable]);

    const result = await calculateEngagement("instagram", "brand");

    expect(result.perPost.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("throws no_posts when no sampled post has readable counts", async () => {
    usePosts([
      { ...post("x", 0, 0), likeCount: undefined as unknown as number },
      post("y", Number.NaN, 4),
    ]);

    const error = await calculateEngagement("instagram", "brand").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EngagementError);
    expect(error).toMatchObject({ reason: "no_posts" });
  });

  it("throws no_posts when the profile returns no posts at all", async () => {
    usePosts([]);

    await expect(calculateEngagement("instagram", "brand")).rejects.toMatchObject({ reason: "no_posts" });
  });
});
