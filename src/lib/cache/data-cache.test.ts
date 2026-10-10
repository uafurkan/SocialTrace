import { describe, expect, it } from "vitest";

import { DATA_CACHE_TTL_MS, RESOURCE_CACHE_TTL_MS, postsCacheKey, postsSizeBucket, ttlForCacheKey } from "./data-cache";

const HOUR_MS = 60 * 60 * 1000;

describe("ttlForCacheKey", () => {
  it("gives follower and following member lists the 48 hour window", () => {
    expect(ttlForCacheKey("members:followers:x")).toBe(48 * HOUR_MS);
    expect(ttlForCacheKey("members:following:some_user")).toBe(48 * HOUR_MS);
  });

  it("keeps posts on the default window", () => {
    expect(ttlForCacheKey("posts:profile_nike:b24")).toBe(DATA_CACHE_TTL_MS);
    expect(ttlForCacheKey("posts:profile_nike")).toBe(DATA_CACHE_TTL_MS);
  });

  it("falls back to the default for an unknown resource", () => {
    expect(ttlForCacheKey("unknown:profile_nike")).toBe(DATA_CACHE_TTL_MS);
  });

  it("falls back to the default for names that exist on Object.prototype", () => {
    expect(ttlForCacheKey("constructor:x")).toBe(DATA_CACHE_TTL_MS);
    expect(ttlForCacheKey("toString:x")).toBe(DATA_CACHE_TTL_MS);
    expect(ttlForCacheKey("__proto__:x")).toBe(DATA_CACHE_TTL_MS);
  });

  it("gives likers and comments the 6 hour engagement window", () => {
    expect(ttlForCacheKey("engagement:likers:https://www.instagram.com/p/abc/:50")).toBe(6 * HOUR_MS);
    expect(ttlForCacheKey("engagement:comments:tiktok:https://www.tiktok.com/@a/video/1:50")).toBe(6 * HOUR_MS);
  });

  it("keeps the stories and linkedin windows unchanged", () => {
    expect(ttlForCacheKey("stories:profile_nike")).toBe(1 * HOUR_MS);
    expect(ttlForCacheKey("linkedin-profile:some-slug")).toBe(24 * HOUR_MS);
  });

  it("reads the resource from the text before the first colon only", () => {
    expect(ttlForCacheKey("members:followers:a:b:c")).toBe(RESOURCE_CACHE_TTL_MS.members);
  });
});

describe("postsSizeBucket", () => {
  it("uses the smallest bucket that covers the requested limit", () => {
    expect(postsSizeBucket(1)).toBe(24);
    expect(postsSizeBucket(12)).toBe(24);
    expect(postsSizeBucket(24)).toBe(24);
    expect(postsSizeBucket(25)).toBe(50);
    expect(postsSizeBucket(50)).toBe(50);
    expect(postsSizeBucket(51)).toBe(100);
    expect(postsSizeBucket(100)).toBe(100);
  });

  it("caps anything above the largest bucket at 100", () => {
    expect(postsSizeBucket(101)).toBe(100);
    expect(postsSizeBucket(124)).toBe(100);
    expect(postsSizeBucket(10_000)).toBe(100);
  });

  it("treats a zero or negative limit as the smallest bucket", () => {
    expect(postsSizeBucket(0)).toBe(24);
    expect(postsSizeBucket(-5)).toBe(24);
  });
});

describe("postsCacheKey", () => {
  it("keys a post list by its profile and bucket", () => {
    expect(postsCacheKey("profile_nike", 12)).toBe("posts:profile_nike:b24");
    expect(postsCacheKey("profile_nike", 30)).toBe("posts:profile_nike:b50");
    expect(postsCacheKey("profile_nike", 100)).toBe("posts:profile_nike:b100");
  });

  it("gives the export's 100-item request its own key, separate from the 24-item one", () => {
    expect(postsCacheKey("profile_nike", 100)).not.toBe(postsCacheKey("profile_nike", 24));
  });

  it("gives every request inside one bucket the same key", () => {
    expect(postsCacheKey("profile_nike", 13)).toBe(postsCacheKey("profile_nike", 24));
    expect(postsCacheKey("profile_nike", 51)).toBe(postsCacheKey("profile_nike", 500));
  });

  it("keeps different profiles apart", () => {
    expect(postsCacheKey("profile_a", 24)).not.toBe(postsCacheKey("profile_b", 24));
  });
});
