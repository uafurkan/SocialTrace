import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calculateEngagement } = vi.hoisted(() => ({ calculateEngagement: vi.fn() }));

vi.mock("@/lib/engagement/calculate", () => {
  class EngagementError extends Error {
    constructor(
      public reason: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { calculateEngagement, EngagementError };
});

import { POST } from "./route";

import { CHAIN_DEADLINE_MS } from "@/lib/cache/cold-budget";

const okResult = { sample: 12, medianEngagement: 4.2 };

function post(body: unknown, ip: string) {
  return POST(
    new NextRequest("https://example.com/api/v1/competitor-analyzer", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const pair = {
  a: { platform: "instagram", username: "alpha_brand" },
  b: { platform: "tiktok", username: "beta_brand" },
};

describe("POST /api/v1/competitor-analyzer deadlines", () => {
  beforeEach(() => {
    calculateEngagement.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the other side's result when one side runs past its 45 s deadline", async () => {
    calculateEngagement.mockImplementation((platform: string) =>
      platform === "tiktok" ? new Promise(() => {}) : Promise.resolve(okResult),
    );

    const responsePromise = post(pair, "198.51.100.80");
    await vi.waitFor(() => expect(calculateEngagement).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(CHAIN_DEADLINE_MS);
    const res = await responsePromise;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.a.result).toEqual(okResult);
    expect(body.b.result).toBeUndefined();
    expect(body.b.error.reason).toBe("timeout");
  });

  it("returns 504 when both sides run past their deadline", async () => {
    calculateEngagement.mockImplementation(() => new Promise(() => {}));

    const responsePromise = post(pair, "198.51.100.81");
    await vi.waitFor(() => expect(calculateEngagement).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(CHAIN_DEADLINE_MS);
    const res = await responsePromise;

    expect(res.status).toBe(504);
    expect((await res.json()).a.error.reason).toBe("timeout");
  });

  it("leaves both results untouched when both sides finish in time", async () => {
    calculateEngagement.mockResolvedValue(okResult);

    const res = await post(pair, "198.51.100.82");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.a.result).toEqual(okResult);
    expect(body.b.result).toEqual(okResult);
  });
});
