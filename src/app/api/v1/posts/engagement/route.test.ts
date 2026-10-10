import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { provider } = vi.hoisted(() => ({
  provider: {
    capabilities: { postEngagement: true },
    getLikers: vi.fn(),
    getComments: vi.fn(),
  },
}));

vi.mock("@/lib/providers", () => ({ getProvider: () => provider }));

import { GET } from "./route";

const CHAIN_DEADLINE_MS = 45_000;

function call(ip: string) {
  const permalink = encodeURIComponent("https://www.instagram.com/p/abc123/");
  return GET(
    new NextRequest(`https://example.com/api/v1/posts/engagement?platform=instagram&permalink=${permalink}`, {
      headers: { "x-forwarded-for": ip },
    }),
  );
}

describe("GET /api/v1/posts/engagement deadline", () => {
  beforeEach(() => {
    provider.getLikers.mockReset();
    provider.getComments.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns likers and comments when both finish in time", async () => {
    provider.getLikers.mockResolvedValue([{ username: "fan" }]);
    provider.getComments.mockResolvedValue([]);

    const res = await call("198.51.100.90");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ likers: [{ username: "fan" }], comments: [] });
  });

  it("returns 504 when the lookup runs past 45 s", async () => {
    provider.getLikers.mockReturnValue(new Promise(() => {}));
    provider.getComments.mockResolvedValue([]);

    const responsePromise = call("198.51.100.91");
    await vi.waitFor(() => expect(provider.getLikers).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(CHAIN_DEADLINE_MS);
    const res = await responsePromise;

    expect(res.status).toBe(504);
  });
});
