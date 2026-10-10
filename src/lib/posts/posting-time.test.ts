import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/domain/types";

import {
  bandRange,
  buildPostingTimes,
  findBusiestCell,
  getVisitorTimeZone,
  groupHoursIntoBands,
  heatOpacity,
} from "./posting-time";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function post(overrides: Partial<Post> & Pick<Post, "id">): Post {
  return {
    profileId: "p1",
    mediaType: "image",
    thumbnailUrl: "",
    mediaUrl: "",
    permalink: "",
    caption: "",
    likeCount: 0,
    commentCount: 0,
    viewCount: null,
    postedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

function emptyGrid(rows: number, columns: number): number[][] {
  return Array.from({ length: rows }, () => Array<number>(columns).fill(0));
}

describe("buildPostingTimes", () => {
  it("returns a zeroed 7 by 24 grid when there are no posts", () => {
    const result = buildPostingTimes([], "UTC", NOW);
    expect(result.grid).toEqual(emptyGrid(7, 24));
    expect(result).toMatchObject({ datedCount: 0, skippedNoDate: 0, timeZone: "UTC" });
  });

  it("places a UTC time by weekday (Monday first) and hour", () => {
    // 2026-01-05 is a Monday.
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-01-05T18:30:00.000Z" })], "UTC", NOW);
    expect(result.grid[0][18]).toBe(1);
    expect(result.datedCount).toBe(1);
  });

  it("maps Sunday to the last row", () => {
    // 2026-01-04 is a Sunday.
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-01-04T12:00:00.000Z" })], "UTC", NOW);
    expect(result.grid[6][12]).toBe(1);
  });

  it("shifts the weekday and hour into the given zone", () => {
    const monday1830Utc = post({ id: "a", postedAt: "2026-01-05T18:30:00.000Z" });
    // 13:30 Monday in New York (UTC-5 in January).
    expect(buildPostingTimes([monday1830Utc], "America/New_York", NOW).grid[0][13]).toBe(1);
    // 03:30 Tuesday in Tokyo (UTC+9).
    expect(buildPostingTimes([monday1830Utc], "Asia/Tokyo", NOW).grid[1][3]).toBe(1);
  });

  it("follows daylight saving time in the given zone", () => {
    // 2026-05-03 is a Sunday. 16:00 UTC is 12:00 in New York (UTC-4 under daylight time).
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-05-03T16:00:00.000Z" })], "America/New_York", NOW);
    expect(result.grid[6][12]).toBe(1);
  });

  it("handles zones with half-hour offsets", () => {
    // 00:00 UTC Monday is 05:30 Monday in Kolkata.
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-01-05T00:00:00.000Z" })], "Asia/Kolkata", NOW);
    expect(result.grid[0][5]).toBe(1);
  });

  it("reports midnight as hour 0, not 24", () => {
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-01-05T00:10:00.000Z" })], "UTC", NOW);
    expect(result.grid[0][0]).toBe(1);
    expect(result.grid.flat().reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it("counts posts with no usable date as skipped and keeps them out of the grid", () => {
    const result = buildPostingTimes(
      [
        post({ id: "a", postedAt: null }),
        post({ id: "b", postedAt: "not a date" }),
        post({ id: "c", postedAt: "2026-01-05T10:00:00.000Z" }),
      ],
      "UTC",
      NOW,
    );
    expect(result.datedCount).toBe(1);
    expect(result.skippedNoDate).toBe(2);
    expect(result.grid.flat().reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it("treats a date more than a day after now as unknown", () => {
    const result = buildPostingTimes([post({ id: "a", postedAt: "2026-06-05T00:00:00.000Z" })], "UTC", NOW);
    expect(result).toMatchObject({ datedCount: 0, skippedNoDate: 1 });
  });

  it("rejects a zone the runtime does not know", () => {
    expect(() => buildPostingTimes([], "Not/A_Zone", NOW)).toThrow(RangeError);
  });
});

describe("getVisitorTimeZone", () => {
  it("returns a zone that the Intl API accepts", () => {
    const zone = getVisitorTimeZone();
    expect(zone.length).toBeGreaterThan(0);
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })).not.toThrow();
  });
});

describe("groupHoursIntoBands", () => {
  it("sums each run of hours into its band and keeps the total", () => {
    const grid = emptyGrid(7, 24);
    grid[2][0] = 1;
    grid[2][2] = 2;
    grid[2][3] = 4;
    grid[2][23] = 8;
    const bands = groupHoursIntoBands(grid, 3);
    expect(bands).toHaveLength(7);
    bands.forEach((row) => expect(row).toHaveLength(8));
    expect(bands[2]).toEqual([3, 4, 0, 0, 0, 0, 0, 8]);
  });

  it("rejects band sizes that do not divide 24", () => {
    expect(() => groupHoursIntoBands(emptyGrid(7, 24), 5)).toThrow(RangeError);
  });
});

describe("bandRange", () => {
  it("labels the first and last 3-hour bands", () => {
    expect(bandRange(0, 3)).toEqual({ short: "00–03", long: "00:00–03:00" });
    expect(bandRange(7, 3)).toEqual({ short: "21–24", long: "21:00–24:00" });
  });
});

describe("findBusiestCell", () => {
  it("returns null when every cell is zero", () => {
    expect(findBusiestCell(emptyGrid(7, 8))).toBeNull();
  });

  it("returns the highest cell and counts how many cells tie with it", () => {
    const grid = emptyGrid(7, 8);
    grid[1][4] = 3;
    grid[5][0] = 3;
    grid[6][7] = 2;
    expect(findBusiestCell(grid)).toEqual({ row: 1, column: 4, count: 3, tied: 2 });
  });

  it("returns a single cell with tied 1 when the maximum is unique", () => {
    const grid = emptyGrid(7, 8);
    grid[0][0] = 1;
    grid[3][2] = 5;
    expect(findBusiestCell(grid)).toEqual({ row: 3, column: 2, count: 5, tied: 1 });
  });
});

describe("heatOpacity", () => {
  it("is transparent for an empty cell and fully opaque for the busiest cell", () => {
    expect(heatOpacity(0, 10)).toBe(0);
    expect(heatOpacity(10, 10)).toBe(1);
  });

  it("keeps a faint non-zero cell visible and never decreases as the count rises", () => {
    expect(heatOpacity(1, 10)).toBeGreaterThanOrEqual(0.25);
    expect(heatOpacity(4, 10)).toBeGreaterThan(heatOpacity(2, 10));
    expect(heatOpacity(10, 10)).toBeGreaterThan(heatOpacity(4, 10));
  });
});
