import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/domain/types";

import { buildPostTrend } from "./trend";

const NOW = new Date("2026-06-01T00:00:00.000Z");

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
    postedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildPostTrend", () => {
  it("returns no buckets when no post has a usable date", () => {
    const trend = buildPostTrend([post({ id: "a", postedAt: null }), post({ id: "b", postedAt: "not a date" })], NOW);
    expect(trend).toEqual({ granularity: null, buckets: [], datedCount: 0, skippedNoDate: 2 });
  });

  it("counts posts without a usable date as skipped and never places them in a bucket", () => {
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2026-05-04T10:00:00.000Z" }),
        post({ id: "b", postedAt: null }),
        post({ id: "c", postedAt: "2026-05-05T10:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.datedCount).toBe(2);
    expect(trend.skippedNoDate).toBe(1);
    expect(trend.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });

  it("buckets short spans by ISO week, starting on Monday in UTC", () => {
    // 2026-01-04 is a Sunday, so it belongs to the week that began Monday 2025-12-29.
    const trend = buildPostTrend(
      [
        post({ id: "sun", postedAt: "2026-01-04T23:59:00.000Z" }),
        post({ id: "mon", postedAt: "2026-01-05T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.granularity).toBe("week");
    expect(trend.buckets.map((bucket) => [bucket.start, bucket.label, bucket.count])).toEqual([
      ["2025-12-29", "Dec 29, 2025", 1],
      ["2026-01-05", "Jan 5, 2026", 1],
    ]);
  });

  it("keeps empty weeks between the first and last bucket, with null averages", () => {
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2026-01-05T10:00:00.000Z", likeCount: 10, commentCount: 1 }),
        post({ id: "b", postedAt: "2026-01-19T10:00:00.000Z", likeCount: 30, commentCount: 3 }),
      ],
      NOW,
    );
    expect(trend.buckets.map((bucket) => bucket.start)).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
    expect(trend.buckets[1]).toEqual({
      label: "Jan 12, 2026",
      start: "2026-01-12",
      count: 0,
      avgLikes: null,
      avgComments: null,
    });
  });

  it("averages likes and comments over the posts in each bucket", () => {
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2026-01-05T10:00:00.000Z", likeCount: 10, commentCount: 1 }),
        post({ id: "b", postedAt: "2026-01-07T10:00:00.000Z", likeCount: 20, commentCount: 2 }),
        post({ id: "c", postedAt: "2026-01-12T10:00:00.000Z", likeCount: 300, commentCount: 9 }),
      ],
      NOW,
    );
    expect(trend.buckets[0]).toMatchObject({ count: 2, avgLikes: 15, avgComments: 1.5 });
    expect(trend.buckets[1]).toMatchObject({ count: 1, avgLikes: 300, avgComments: 9 });
  });

  it("leaves one average null when that metric has no finite value in the bucket", () => {
    const trend = buildPostTrend(
      [post({ id: "a", postedAt: "2026-01-05T10:00:00.000Z", likeCount: Number.NaN, commentCount: 4 })],
      NOW,
    );
    expect(trend.buckets[0]).toMatchObject({ count: 1, avgLikes: null, avgComments: 4 });
  });

  it("buckets spans of exactly 90 days by calendar month", () => {
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
        post({ id: "b", postedAt: "2026-04-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.granularity).toBe("month");
    expect(trend.buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ["Jan 2026", 1],
      ["Feb 2026", 0],
      ["Mar 2026", 0],
      ["Apr 2026", 1],
    ]);
    expect(trend.buckets[0].start).toBe("2026-01-01");
  });

  it("uses weeks for a span of 89 days", () => {
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2026-01-01T00:00:00.000Z" }),
        post({ id: "b", postedAt: "2026-03-31T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.granularity).toBe("week");
  });

  it("assigns each post to its UTC calendar month across a year boundary", () => {
    // 2026-01-31 23:30 at UTC-5 is already 2026-02-01 04:30 UTC, so it lands in February.
    const trend = buildPostTrend(
      [
        post({ id: "a", postedAt: "2025-11-15T12:00:00.000Z" }),
        post({ id: "b", postedAt: "2026-01-31T23:30:00.000-05:00" }),
        post({ id: "c", postedAt: "2026-03-05T12:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.granularity).toBe("month");
    expect(trend.buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ["Nov 2025", 1],
      ["Dec 2025", 0],
      ["Jan 2026", 0],
      ["Feb 2026", 1],
      ["Mar 2026", 1],
    ]);
  });

  it("treats a date more than a day after now as unknown, but keeps a date within the allowance", () => {
    const trend = buildPostTrend(
      [
        post({ id: "within", postedAt: "2026-06-01T20:00:00.000Z" }),
        post({ id: "ahead", postedAt: "2026-06-04T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(trend.datedCount).toBe(1);
    expect(trend.skippedNoDate).toBe(1);
  });
});
