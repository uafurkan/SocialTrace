import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/domain/types";

import {
  countUndatedPosts,
  DEFAULT_POST_SORT,
  filterPostsByDate,
  hasDateFilter,
  POST_SORT_OPTIONS,
  postDayLocal,
  sortOptionValue,
  sortPosts,
} from "./grid";

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

function ids(posts: Post[]): string[] {
  return posts.map((item) => item.id);
}

/**
 * An ISO instant for a wall-clock time in the machine's own zone. Built with
 * the local Date constructor so the local day is the same whatever TZ the
 * tests run in.
 */
function localAt(year: number, monthIndex: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, monthIndex, day, hour, minute).toISOString();
}

describe("sortPosts", () => {
  const posts = [
    post({ id: "a", likeCount: 5, commentCount: 1, viewCount: 100, postedAt: "2026-03-01T00:00:00.000Z" }),
    post({ id: "b", likeCount: 9, commentCount: 4, viewCount: null, postedAt: null }),
    post({ id: "c", likeCount: 2, commentCount: 7, viewCount: 300, postedAt: "2026-01-15T00:00:00.000Z" }),
    post({ id: "d", likeCount: 9, commentCount: 0, viewCount: 50, postedAt: "2026-02-10T00:00:00.000Z" }),
  ];

  it("keeps the original order for the default key and returns a new array", () => {
    const sorted = sortPosts(posts, "default", "desc");
    expect(ids(sorted)).toEqual(["a", "b", "c", "d"]);
    expect(sorted).not.toBe(posts);
  });

  it("does not mutate the input", () => {
    const copy = [...posts];
    sortPosts(posts, "likes", "asc");
    expect(posts).toEqual(copy);
  });

  it("sorts by views in both directions and puts null views last", () => {
    expect(ids(sortPosts(posts, "views", "desc"))).toEqual(["c", "a", "d", "b"]);
    expect(ids(sortPosts(posts, "views", "asc"))).toEqual(["d", "a", "c", "b"]);
  });

  it("sorts by likes and comments in both directions", () => {
    expect(ids(sortPosts(posts, "likes", "desc"))).toEqual(["b", "d", "a", "c"]);
    expect(ids(sortPosts(posts, "likes", "asc"))).toEqual(["c", "a", "b", "d"]);
    expect(ids(sortPosts(posts, "comments", "desc"))).toEqual(["c", "b", "a", "d"]);
    expect(ids(sortPosts(posts, "comments", "asc"))).toEqual(["d", "a", "b", "c"]);
  });

  it("sorts by date in both directions and puts null dates last", () => {
    expect(ids(sortPosts(posts, "date", "desc"))).toEqual(["a", "d", "c", "b"]);
    expect(ids(sortPosts(posts, "date", "asc"))).toEqual(["c", "d", "a", "b"]);
  });

  it("treats an unparseable postedAt like a missing one", () => {
    const withBadDate = [
      post({ id: "bad", postedAt: "not a date" }),
      post({ id: "good", postedAt: "2026-05-05T00:00:00.000Z" }),
    ];
    expect(ids(sortPosts(withBadDate, "date", "asc"))).toEqual(["good", "bad"]);
    expect(ids(sortPosts(withBadDate, "date", "desc"))).toEqual(["good", "bad"]);
  });

  it("keeps tied posts in their original order in both directions", () => {
    expect(ids(sortPosts(posts, "likes", "desc"))).toEqual(["b", "d", "a", "c"]);
    const tied = [
      post({ id: "x", likeCount: 3 }),
      post({ id: "y", likeCount: 3 }),
      post({ id: "z", likeCount: 3 }),
    ];
    expect(ids(sortPosts(tied, "likes", "asc"))).toEqual(["x", "y", "z"]);
    expect(ids(sortPosts(tied, "likes", "desc"))).toEqual(["x", "y", "z"]);
  });

  it("keeps null-valued posts in their original order among themselves", () => {
    const nulls = [
      post({ id: "n1", viewCount: null }),
      post({ id: "v", viewCount: 10 }),
      post({ id: "n2", viewCount: null }),
    ];
    expect(ids(sortPosts(nulls, "views", "asc"))).toEqual(["v", "n1", "n2"]);
    expect(ids(sortPosts(nulls, "views", "desc"))).toEqual(["v", "n1", "n2"]);
  });
});

describe("postDayLocal", () => {
  it("returns the local calendar day of the stored instant", () => {
    expect(postDayLocal(post({ id: "a", postedAt: localAt(2026, 0, 31, 23, 30) }))).toBe("2026-01-31");
    expect(postDayLocal(post({ id: "b", postedAt: localAt(2026, 2, 10, 0, 5) }))).toBe("2026-03-10");
  });

  it("agrees with the date the table's column shows for the same post", () => {
    const postedAt = localAt(2026, 0, 31, 23, 30);
    expect(postDayLocal(post({ id: "a", postedAt }))).toBe("2026-01-31");
    expect(new Date(postedAt).toLocaleDateString("en-US")).toBe("1/31/2026");
  });

  it("returns null for a missing or unparseable date", () => {
    expect(postDayLocal(post({ id: "a", postedAt: null }))).toBeNull();
    expect(postDayLocal(post({ id: "b", postedAt: "soon" }))).toBeNull();
  });
});

describe("filterPostsByDate", () => {
  const posts = [
    post({ id: "early", postedAt: localAt(2026, 0, 1, 12) }),
    post({ id: "mid", postedAt: localAt(2026, 0, 15, 8) }),
    post({ id: "late", postedAt: localAt(2026, 0, 31, 23, 59) }),
    post({ id: "unknown", postedAt: null }),
  ];

  it("returns every post, including undated ones, when no bound is set", () => {
    expect(ids(filterPostsByDate(posts, "", ""))).toEqual(["early", "mid", "late", "unknown"]);
  });

  it("treats both bounds as inclusive days", () => {
    expect(ids(filterPostsByDate(posts, "2026-01-01", "2026-01-15"))).toEqual(["early", "mid"]);
    expect(ids(filterPostsByDate(posts, "2026-01-15", "2026-01-31"))).toEqual(["mid", "late"]);
  });

  it("applies a single open-ended bound", () => {
    expect(ids(filterPostsByDate(posts, "2026-01-15", ""))).toEqual(["mid", "late"]);
    expect(ids(filterPostsByDate(posts, "", "2026-01-15"))).toEqual(["early", "mid"]);
  });

  it("excludes posts with an unknown date once a bound is set", () => {
    expect(ids(filterPostsByDate(posts, "2026-01-01", "2026-12-31"))).not.toContain("unknown");
    expect(ids(filterPostsByDate(posts, "", "2026-12-31"))).not.toContain("unknown");
  });

  it("compares the local calendar day the table shows", () => {
    const lateEvening = [post({ id: "evening", postedAt: localAt(2026, 0, 31, 23, 30) })];
    expect(ids(filterPostsByDate(lateEvening, "2026-01-31", "2026-01-31"))).toEqual(["evening"]);
    expect(ids(filterPostsByDate(lateEvening, "2026-02-01", "2026-02-01"))).toEqual([]);

    const justAfterMidnight = [post({ id: "dawn", postedAt: localAt(2026, 0, 31, 0, 5) })];
    expect(ids(filterPostsByDate(justAfterMidnight, "2026-01-31", "2026-01-31"))).toEqual(["dawn"]);
    expect(ids(filterPostsByDate(justAfterMidnight, "2026-01-30", "2026-01-30"))).toEqual([]);
  });

  it("ignores a malformed or impossible bound instead of guessing", () => {
    // Both bounds invalid means no date filter at all, so nothing is excluded.
    expect(ids(filterPostsByDate(posts, "2026-02-30", ""))).toEqual(["early", "mid", "late", "unknown"]);
    expect(ids(filterPostsByDate(posts, "", "01/15/2026"))).toEqual(["early", "mid", "late", "unknown"]);
    // One valid bound still applies, and the undated post is excluded.
    expect(ids(filterPostsByDate(posts, "2026-02-30", "2026-01-15"))).toEqual(["early", "mid"]);
  });

  it("returns nothing when the range is inverted", () => {
    expect(filterPostsByDate(posts, "2026-01-20", "2026-01-10")).toEqual([]);
  });
});

describe("hasDateFilter", () => {
  it("is false only when neither bound is a valid day", () => {
    expect(hasDateFilter("", "")).toBe(false);
    expect(hasDateFilter("2026-02-30", "")).toBe(false);
    expect(hasDateFilter("2026-01-01", "")).toBe(true);
    expect(hasDateFilter("", "2026-01-01")).toBe(true);
  });
});

describe("countUndatedPosts", () => {
  it("counts posts whose date is missing or unparseable", () => {
    const mixed = [
      post({ id: "a", postedAt: null }),
      post({ id: "b", postedAt: "2026-01-01T00:00:00.000Z" }),
      post({ id: "c", postedAt: "garbage" }),
    ];
    expect(countUndatedPosts(mixed)).toBe(2);
    expect(countUndatedPosts([])).toBe(0);
  });
});

describe("POST_SORT_OPTIONS", () => {
  it("starts from the default sort and has unique option values", () => {
    expect(DEFAULT_POST_SORT.key).toBe("default");
    const values = POST_SORT_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(sortOptionValue(DEFAULT_POST_SORT)).toBe("default");
  });

  it("round-trips every option through sortOptionValue", () => {
    for (const option of POST_SORT_OPTIONS) {
      expect(sortOptionValue(option.sort)).toBe(option.value);
    }
  });
});
