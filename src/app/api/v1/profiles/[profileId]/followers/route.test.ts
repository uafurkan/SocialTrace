import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chargeColdStart } from "@/lib/cache/cold-budget";

const { getFollowers } = vi.hoisted(() => ({ getFollowers: vi.fn() }));

vi.mock("@/lib/providers", () => ({
  provider: { getFollowers },
}));

import { GET } from "./route";

// No UPSTASH_* variables in the test environment, so the cold budget's limiter is in-process.
// Each test uses its own address so budgets do not overlap.
function call(profileId: string, ip: string) {
  const request = new NextRequest("https://example.com/api/v1/profiles/x/followers", {
    headers: { "x-forwarded-for": ip },
  });
  return GET(request, { params: Promise.resolve({ profileId }) });
}

/** Stands in for a data-cache miss: each call starts one cold chain, which is what gets charged. */
function coldProvider() {
  getFollowers.mockImplementation(async () => {
    await chargeColdStart();
    return { items: [], nextCursor: null };
  });
}

describe("GET /api/v1/profiles/[profileId]/followers", () => {
  beforeEach(() => {
    getFollowers.mockReset();
    getFollowers.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("rejects empty, slash-containing and overlong profile ids before calling the provider", async () => {
    const invalid = ["", "   ", "a/b", "x".repeat(101)];
    for (const [i, profileId] of invalid.entries()) {
      const res = await call(profileId, `198.51.100.${10 + i}`);
      expect(res.status).toBe(400);
    }
    expect(getFollowers).not.toHaveBeenCalled();
  });

  it("passes a valid profile id to the provider", async () => {
    const res = await call("someuser", "198.51.100.1");
    expect(res.status).toBe(200);
    expect(getFollowers).toHaveBeenCalledWith("someuser", undefined, 60, undefined);
  });

  it("does not limit cached pages: a provider that starts no cold chain is never refused", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await call("someuser", "198.51.100.2")).status).toBe(200);
    }
    expect(getFollowers).toHaveBeenCalledTimes(25);
  });

  it("returns 429 with Retry-After once one address has started 6 cold lists", async () => {
    coldProvider();
    for (let i = 0; i < 6; i++) {
      expect((await call(`list${i}`, "198.51.100.3")).status).toBe(200);
    }

    const res = await call("list6", "198.51.100.3");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(getFollowers).toHaveBeenCalledTimes(7);
  });

  it("answers 502, not 429, when a cold chain is cut off before any actor returned data", async () => {
    getFollowers.mockRejectedValueOnce(
      new Error("Member lookup for someuser (followers) reached the 45s limit before any actor returned data."),
    );

    const res = await call("someuser", "198.51.100.7");

    expect(res.status).toBe(502);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("keeps the cold budget per address", async () => {
    coldProvider();
    for (let i = 0; i < 6; i++) {
      await call(`list${i}`, "198.51.100.4");
    }
    expect((await call("other", "198.51.100.5")).status).toBe(200);
  });
});
