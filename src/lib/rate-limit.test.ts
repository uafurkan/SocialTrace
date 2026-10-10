import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIdentifierFor, rateLimit } from "./rate-limit";

// Upstash clients are mocked for the whole file (vi.mock is hoisted). The
// original tests run with no UPSTASH_* variables, so they never reach these
// mocks; the Upstash describe below opts in through stubbed env and a fresh
// module instance (the Redis client is created lazily per module).
const upstash = vi.hoisted(() => ({
  limit: vi.fn(),
  redisConstructed: 0,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      upstash.redisConstructed += 1;
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }

    limit(key: string) {
      return upstash.limit(key);
    }
  },
}));

// No UPSTASH_REDIS_REST_URL/TOKEN in the test environment, so every call
// here exercises the in-process fallback path.
describe("rateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", async () => {
    const key = `test-allow-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit(key, 5, 10_000)).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", async () => {
    const key = `test-block-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      await rateLimit(key, 3, 10_000);
    }
    const result = await rateLimit(key, 3, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the bucket after the window elapses", async () => {
    vi.useFakeTimers();
    const key = `test-reset-${Math.random()}`;
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    for (let i = 0; i < 2; i++) {
      expect((await rateLimit(key, 2, 1_000)).allowed).toBe(true);
    }
    expect((await rateLimit(key, 2, 1_000)).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-09-04T12:00:01.100Z"));
    expect((await rateLimit(key, 2, 1_000)).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test-independent-a-${Math.random()}`;
    const keyB = `test-independent-b-${Math.random()}`;
    await rateLimit(keyA, 1, 10_000);
    expect((await rateLimit(keyA, 1, 10_000)).allowed).toBe(false);
    expect((await rateLimit(keyB, 1, 10_000)).allowed).toBe(true);
  });
});

describe("in-process bucket sweep", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("removes expired buckets once the map reaches its threshold", async () => {
    const { rateLimit: limit, inProcessBucketCount, BUCKET_SWEEP_THRESHOLD } = await import("./rate-limit");

    // Half of the keys expire after 1 s; the other half stay live for 60 s.
    const half = BUCKET_SWEEP_THRESHOLD / 2;
    for (let i = 0; i < BUCKET_SWEEP_THRESHOLD; i++) {
      await limit(`sweep-${i}`, 1, i < half ? 1_000 : 60_000);
    }
    expect(inProcessBucketCount()).toBe(BUCKET_SWEEP_THRESHOLD);

    vi.setSystemTime(new Date("2026-09-04T12:00:02Z"));
    await limit("sweep-trigger", 1, 60_000);

    // The expired half is gone; the live half and the new key remain.
    expect(inProcessBucketCount()).toBe(half + 1);
    expect((await limit(`sweep-${BUCKET_SWEEP_THRESHOLD - 1}`, 1, 60_000)).allowed).toBe(false);
  });
});

describe("rateLimit with Upstash configured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    upstash.limit.mockReset();
    upstash.redisConstructed = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the Upstash decision when the call succeeds", async () => {
    const { rateLimit: limit } = await import("./rate-limit");
    upstash.limit.mockResolvedValue({ success: false, reset: Date.now() + 5_000 });

    const result = await limit("upstash-denied", 3, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(5);
  });

  it("creates one Redis client for the process", async () => {
    const { rateLimit: limit } = await import("./rate-limit");
    upstash.limit.mockResolvedValue({ success: true, reset: Date.now() + 5_000 });

    for (let i = 0; i < 3; i++) {
      await limit(`upstash-reuse-${i}`, 3, 10_000);
    }
    expect(upstash.limit).toHaveBeenCalledTimes(3);
    expect(upstash.redisConstructed).toBe(1);
  });

  it("falls back to the in-process counter when the Upstash call throws", async () => {
    const { rateLimit: limit } = await import("./rate-limit");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    upstash.limit.mockRejectedValue(new Error("connection reset"));

    const key = `upstash-fallback-${Math.random()}`;
    expect((await limit(key, 2, 10_000)).allowed).toBe(true);
    expect((await limit(key, 2, 10_000)).allowed).toBe(true);
    const third = await limit(key, 2, 10_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("clientIdentifierFor", () => {
  it("reads the first address from x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.1, 70.41.3.18" },
    });
    expect(clientIdentifierFor(request)).toBe("203.0.113.1");
  });

  it("falls back to 'unknown' when the header is missing", () => {
    const request = new Request("https://example.com");
    expect(clientIdentifierFor(request)).toBe("unknown");
  });
});
