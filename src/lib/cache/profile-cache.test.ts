import { describe, expect, it } from "vitest";

import { isFresh } from "./profile-cache";

describe("isFresh", () => {
  it("is fresh right after fetching", () => {
    const fetchedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-01T00:00:01Z");
    expect(isFresh(fetchedAt, now, 60_000)).toBe(true);
  });

  it("is stale once the TTL has fully elapsed", () => {
    const fetchedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-01T00:01:00Z");
    expect(isFresh(fetchedAt, now, 60_000)).toBe(false);
  });

  it("is stale the instant the TTL boundary is reached", () => {
    const fetchedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(isFresh(fetchedAt, new Date(now.getTime() + 60_000), 60_000)).toBe(false);
  });
});
