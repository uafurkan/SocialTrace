import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/domain/types";

import { computePostInsights, filterPostsByCaption, median } from "./insights";

function post(overrides: Partial<Post> & Pick<Post, "id">): Post {
  return {
    profileId: "p1",
    mediaType: "image",
    thumbnailUrl: "",
    mediaUrl: "",
    permalink: "",
    caption: "",
    likeCount: 0,
    commentCount: 0,
    viewCount: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("median", () => {
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });

  it("picks the middle value for odd-length lists", () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it("averages the two middle values for even-length lists", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("computePostInsights", () => {
  it("returns zeroed stats and no frequency for an empty sample", () => {
    expect(computePostInsights([])).toEqual({
      sampleSize: 0,
      avgLikes: 0,
      medianLikes: 0,
      avgComments: 0,
      medianComments: 0,
      avgViews: null,
      daysBetweenPosts: null,
    });
  });

  it("averages and medians likes and comments", () => {
    const insights = computePostInsights([
      post({ id: "a", likeCount: 10, commentCount: 1 }),
      post({ id: "b", likeCount: 20, commentCount: 3 }),
      post({ id: "c", likeCount: 300, commentCount: 5 }),
    ]);
    expect(insights.sampleSize).toBe(3);
    expect(insights.avgLikes).toBe(110);
    expect(insights.medianLikes).toBe(20);
    expect(insights.avgComments).toBeCloseTo(3);
    expect(insights.medianComments).toBe(3);
  });

  it("averages only posts that report views", () => {
    const insights = computePostInsights([
      post({ id: "a", viewCount: 100 }),
      post({ id: "b", viewCount: null }),
      post({ id: "c", viewCount: 300 }),
    ]);
    expect(insights.avgViews).toBe(200);
  });

  it("reports null views when no post has a view count", () => {
    expect(computePostInsights([post({ id: "a" })]).avgViews).toBeNull();
  });

  it("computes the average gap between posts regardless of input order", () => {
    const insights = computePostInsights([
      post({ id: "c", postedAt: "2026-01-21T00:00:00.000Z" }),
      post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "b", postedAt: "2026-01-11T00:00:00.000Z" }),
    ]);
    expect(insights.daysBetweenPosts).toBe(10);
  });

  it("ignores posts with unparseable dates when measuring frequency", () => {
    const insights = computePostInsights([
      post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "b", postedAt: "not a date" }),
    ]);
    expect(insights.daysBetweenPosts).toBeNull();
  });

  it("excludes posts with no date from the frequency and keeps the gap between dated posts", () => {
    const insights = computePostInsights([
      post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "x", postedAt: null }),
      post({ id: "b", postedAt: "2026-01-11T00:00:00.000Z" }),
      post({ id: "y", postedAt: null }),
    ]);
    expect(insights.daysBetweenPosts).toBe(10);
  });

  it("reports no frequency when fewer than two posts have a date", () => {
    const insights = computePostInsights([
      post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "b", postedAt: null }),
      post({ id: "c", postedAt: null }),
    ]);
    expect(insights.daysBetweenPosts).toBeNull();
  });

  it("leaves the like, comment and view averages unchanged when posts lose their date", () => {
    const dated = [
      post({ id: "a", likeCount: 10, commentCount: 1, viewCount: 100, postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "b", likeCount: 30, commentCount: 5, viewCount: 300, postedAt: "2026-01-11T00:00:00.000Z" }),
      post({ id: "c", likeCount: 500, commentCount: 50, viewCount: null, postedAt: "2026-01-21T00:00:00.000Z" }),
    ];
    const undated = dated.map((p) => ({ ...p, postedAt: null }));

    expect(computePostInsights(undated)).toEqual({ ...computePostInsights(dated), daysBetweenPosts: null });
  });
});

describe("filterPostsByCaption", () => {
  const posts = [
    post({ id: "a", caption: "Summer beach day #travel" }),
    post({ id: "b", caption: "New recipe is out" }),
    post({ id: "c", caption: "TRAVEL diary, part 2" }),
  ];

  it("keeps every post for a blank query", () => {
    expect(filterPostsByCaption(posts, "   ")).toHaveLength(3);
  });

  it("matches captions case-insensitively", () => {
    expect(filterPostsByCaption(posts, "travel").map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterPostsByCaption(posts, "xyz")).toEqual([]);
  });
});
