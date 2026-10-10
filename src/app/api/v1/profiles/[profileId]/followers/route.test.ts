import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFollowers } = vi.hoisted(() => ({ getFollowers: vi.fn() }));

vi.mock("@/lib/providers", () => ({
  provider: { getFollowers },
}));

import { GET } from "./route";

// No UPSTASH_* variables in the test environment, so the limiter is in-process.
// Each test uses its own address so budgets do not overlap.
function call(profileId: string, ip: string) {
  const request = new NextRequest("https://example.com/api/v1/profiles/x/followers", {
    headers: { "x-forwarded-for": ip },
  });
  return GET(request, { params: Promise.resolve({ profileId }) });
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

  it("returns 429 with Retry-After after 20 requests from one address", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await call("someuser", "198.51.100.2")).status).toBe(200);
    }

    const res = await call("someuser", "198.51.100.2");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(getFollowers).toHaveBeenCalledTimes(20);
  });
});
