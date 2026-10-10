import { describe, expect, it } from "vitest";

import { toPostedAt, unixSecondsToPostedAt } from "./post-date";

describe("toPostedAt", () => {
  it("returns the ISO form of a valid date string", () => {
    expect(toPostedAt("2026-01-05T10:00:00.000Z")).toBe("2026-01-05T10:00:00.000Z");
    expect(toPostedAt("2026-01-05T12:00:00+02:00")).toBe("2026-01-05T10:00:00.000Z");
  });

  it("returns null when there is no date", () => {
    expect(toPostedAt(undefined)).toBeNull();
    expect(toPostedAt(null)).toBeNull();
    expect(toPostedAt("")).toBeNull();
  });

  it("returns null for a value that does not parse, instead of the current time", () => {
    expect(toPostedAt("not a date")).toBeNull();
  });
});

describe("unixSecondsToPostedAt", () => {
  it("converts Unix seconds to an ISO string", () => {
    expect(unixSecondsToPostedAt(1_767_607_200)).toBe("2026-01-05T10:00:00.000Z");
  });

  it("returns null when there is no timestamp", () => {
    expect(unixSecondsToPostedAt(undefined)).toBeNull();
    expect(unixSecondsToPostedAt(null)).toBeNull();
  });

  it("returns null for timestamps that are not finite or are out of range", () => {
    expect(unixSecondsToPostedAt(Number.NaN)).toBeNull();
    expect(unixSecondsToPostedAt(Number.POSITIVE_INFINITY)).toBeNull();
    expect(unixSecondsToPostedAt(1e20)).toBeNull();
  });
});
