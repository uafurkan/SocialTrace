import { describe, expect, it } from "vitest";

import { PLAN_LIMITS, PlanLimitError, assertWithinLimit } from "./plans";

describe("PLAN_LIMITS", () => {
  it("gives the free plan finite limits and pro unlimited", () => {
    expect(PLAN_LIMITS.free.maxTrackedProfiles).toBe(10);
    expect(PLAN_LIMITS.free.maxSavedSearches).toBe(10);
    expect(PLAN_LIMITS.pro.maxTrackedProfiles).toBe(Infinity);
    expect(PLAN_LIMITS.pro.maxSavedSearches).toBe(Infinity);
  });
});

describe("assertWithinLimit", () => {
  it("does not throw below the limit", () => {
    expect(() => assertWithinLimit("free", "tracked profiles", 0)).not.toThrow();
    expect(() => assertWithinLimit("free", "tracked profiles", 9)).not.toThrow();
  });

  it("throws PlanLimitError once the count reaches the limit", () => {
    expect(() => assertWithinLimit("free", "tracked profiles", 10)).toThrow(PlanLimitError);
  });

  it("throws with a message naming the plan and limit", () => {
    try {
      assertWithinLimit("free", "saved searches", 10);
      throw new Error("expected assertWithinLimit to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanLimitError);
      expect((error as Error).message).toMatch(/free plan is limited to 10 saved searches/);
    }
  });

  it("never throws for the pro plan", () => {
    expect(() => assertWithinLimit("pro", "tracked profiles", 1_000_000)).not.toThrow();
  });
});
