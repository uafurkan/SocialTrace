import { describe, expect, it } from "vitest";

import { PLAN_LIMITS, PlanLimitError, assertWithinLimit } from "./plans";

describe("PLAN_LIMITS", () => {
  it("gives the free plan finite limits and pro unlimited", () => {
    expect(PLAN_LIMITS.free.maxTrackedProfiles).toBe(25);
    expect(PLAN_LIMITS.free.maxSavedSearches).toBe(25);
    expect(PLAN_LIMITS.free.maxTranscriptionsPerDay).toBe(15);
    expect(PLAN_LIMITS.pro.maxTrackedProfiles).toBe(Infinity);
    expect(PLAN_LIMITS.pro.maxSavedSearches).toBe(Infinity);
    expect(PLAN_LIMITS.pro.maxTranscriptionsPerDay).toBe(100);
  });
});

describe("assertWithinLimit", () => {
  it("does not throw below the limit", () => {
    expect(() => assertWithinLimit("free", "tracked profiles", 0)).not.toThrow();
    expect(() => assertWithinLimit("free", "tracked profiles", 24)).not.toThrow();
  });

  it("throws PlanLimitError once the count reaches the limit", () => {
    expect(() => assertWithinLimit("free", "tracked profiles", 25)).toThrow(PlanLimitError);
  });

  it("throws with a message naming the plan and limit", () => {
    try {
      assertWithinLimit("free", "saved searches", 25);
      throw new Error("expected assertWithinLimit to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanLimitError);
      expect((error as Error).message).toMatch(/free plan is limited to 25 saved searches/);
    }
  });

  it("enforces the transcriptions-per-day limit separately from the other resources", () => {
    expect(() => assertWithinLimit("free", "transcriptions per day", 14)).not.toThrow();
    expect(() => assertWithinLimit("free", "transcriptions per day", 15)).toThrow(PlanLimitError);
    expect(() => assertWithinLimit("pro", "transcriptions per day", 99)).not.toThrow();
    expect(() => assertWithinLimit("pro", "transcriptions per day", 100)).toThrow(PlanLimitError);
  });

  it("never throws for the pro plan's unlimited resources", () => {
    expect(() => assertWithinLimit("pro", "tracked profiles", 1_000_000)).not.toThrow();
    expect(() => assertWithinLimit("pro", "saved searches", 1_000_000)).not.toThrow();
  });
});
