import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calculateEngagement } = vi.hoisted(() => ({ calculateEngagement: vi.fn() }));

vi.mock("@/lib/engagement/calculate", () => {
  class EngagementError extends Error {
    constructor(
      public reason: string,
      message: string,
    ) {
      super(message);
      this.name = "EngagementError";
    }
  }
  return { calculateEngagement, EngagementError };
});

import { EngagementError } from "@/lib/engagement/calculate";

import { resolveSide, STATUS_BY_REASON } from "./resolve-side";

import { CHAIN_DEADLINE_MS } from "@/lib/cache/cold-budget";

const okResult = { username: "alpha_brand", engagementRatePercent: 3.1 };

describe("STATUS_BY_REASON", () => {
  it("maps each engagement failure to its HTTP status", () => {
    expect(STATUS_BY_REASON).toEqual({
      profile_not_found: 404,
      private_account: 403,
      no_posts: 422,
      source_unavailable: 503,
    });
  });
});

describe("resolveSide", () => {
  beforeEach(() => {
    calculateEngagement.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the engagement result when the calculation succeeds", async () => {
    calculateEngagement.mockResolvedValue(okResult);

    await expect(resolveSide("instagram", "alpha_brand")).resolves.toEqual({ result: okResult });
    expect(calculateEngagement).toHaveBeenCalledWith("instagram", "alpha_brand");
  });

  it("passes an engagement error through with its reason and message", async () => {
    calculateEngagement.mockRejectedValue(new EngagementError("private_account", "This account is private."));

    await expect(resolveSide("tiktok", "beta_brand")).resolves.toEqual({
      error: { reason: "private_account", message: "This account is private." },
    });
  });

  it("reports a generic engagement_failed for an unexpected error without leaking its message", async () => {
    calculateEngagement.mockRejectedValue(new Error("SELECT * FROM secrets failed"));

    const side = await resolveSide("facebook", "gamma_brand");

    expect(side).toEqual({
      error: { reason: "engagement_failed", message: "Could not calculate engagement for this profile." },
    });
    expect(JSON.stringify(side)).not.toContain("SELECT");
  });

  it("reports a timeout when the side runs past its deadline", async () => {
    vi.useFakeTimers();
    calculateEngagement.mockImplementation(() => new Promise(() => {}));

    const sidePromise = resolveSide("instagram", "slow_brand");
    await vi.advanceTimersByTimeAsync(CHAIN_DEADLINE_MS);

    await expect(sidePromise).resolves.toEqual({
      error: { reason: "timeout", message: "This profile took too long to analyze. Try again in a moment." },
    });
  });
});
