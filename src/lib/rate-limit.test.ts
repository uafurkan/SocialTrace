import { beforeEach, describe, expect, it, vi } from "vitest";

import { clientIdentifierFor, rateLimit } from "./rate-limit";

// No UPSTASH_REDIS_REST_URL/TOKEN in the test environment, so every call
// here exercises the in-process fallback path — the Upstash path is a
// thin pass-through to a well-tested third-party client, not logic of
// this project's to unit test.
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
