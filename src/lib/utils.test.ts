import { describe, expect, it, vi } from "vitest";

import { formatCount, formatRelativeTime } from "./utils";

describe("formatCount", () => {
  it("formats small numbers with locale grouping", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("formats thousands with one decimal and K suffix", () => {
    expect(formatCount(1_000)).toBe("1.0K");
    expect(formatCount(42_183)).toBe("42.2K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCount(1_500_000)).toBe("1.5M");
  });

  it("formats billions with B suffix", () => {
    expect(formatCount(1_500_000_000)).toBe("1.5B");
  });

  it("formats a large real-world follower count as millions, not billions", () => {
    expect(formatCount(312_482_913)).toBe("312.5M");
  });
});

describe("formatRelativeTime", () => {
  it("reports 'just now' for sub-minute deltas", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    expect(formatRelativeTime(new Date("2026-09-04T11:59:45Z").toISOString())).toBe("just now");
    vi.useRealTimers();
  });

  it("reports singular/plural minutes correctly", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    expect(formatRelativeTime(new Date("2026-09-04T11:59:00Z").toISOString())).toBe("1 minute ago");
    expect(formatRelativeTime(new Date("2026-09-04T11:55:00Z").toISOString())).toBe("5 minutes ago");
    vi.useRealTimers();
  });

  it("switches to hours after 60 minutes", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    expect(formatRelativeTime(new Date("2026-09-04T10:00:00Z").toISOString())).toBe("2 hours ago");
    vi.useRealTimers();
  });

  it("switches to days after 24 hours", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    expect(formatRelativeTime(new Date("2026-09-02T12:00:00Z").toISOString())).toBe("2 days ago");
    vi.useRealTimers();
  });
});
