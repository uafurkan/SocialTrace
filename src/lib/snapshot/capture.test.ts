import { describe, expect, it } from "vitest";

import { coveragePercentFor, normalizeUsername } from "./capture";

describe("normalizeUsername", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeUsername("  Nike ")).toBe("nike");
  });

  it("is idempotent", () => {
    expect(normalizeUsername(normalizeUsername("SmallCreator"))).toBe("smallcreator");
  });
});

describe("coveragePercentFor", () => {
  it("returns 0 when total is zero or negative", () => {
    expect(coveragePercentFor(0, 0)).toBe(0);
    expect(coveragePercentFor(5, 0)).toBe(0);
  });

  it("returns 100 for a fully indexed profile", () => {
    expect(coveragePercentFor(180, 180)).toBe(100);
  });

  it("rounds to one decimal place at or above 1%", () => {
    expect(coveragePercentFor(42_183, 42_183)).toBe(100);
    expect(coveragePercentFor(50, 200)).toBe(25);
    expect(coveragePercentFor(1, 3)).toBe(33.3);
  });

  it("keeps two decimal places of precision below 1% so tiny coverage never rounds to a literal 0", () => {
    // Spec §1.2: a huge account with a tiny indexed sample must still show
    // a non-zero percentage, never "0%" as if there were no data at all.
    const result = coveragePercentFor(79_842, 312_482_913);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(0.03, 2);
  });
});
