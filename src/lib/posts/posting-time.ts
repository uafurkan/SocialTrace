import type { Post } from "@/lib/domain/types";
import { readPostedAt } from "@/lib/posts/trend";

/** Monday first, matching ISO weeks. Index 0 is Monday. */
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Weekday names as the en-US formatter prints them, mapped to WEEKDAY_NAMES indexes. */
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export interface PostingTimes {
  /** grid[weekday][hour]: weekday 0 is Monday through 6 is Sunday; hour is 0-23 in `timeZone`. */
  grid: number[][];
  datedCount: number;
  /** Posts with a null, unparseable, or future date. These are not in the grid. */
  skippedNoDate: number;
  timeZone: string;
}

export interface BusiestCell {
  row: number;
  column: number;
  count: number;
  /** How many cells share this count, including the one returned. */
  tied: number;
}

/**
 * The browser's IANA zone, or "UTC" when the browser cannot report one. Only the
 * browser can answer this, so call it on the client.
 */
export function getVisitorTimeZone(): string {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Counts the loaded posts by weekday and hour of day in an IANA zone. Throws a
 * RangeError when `timeZone` is not a zone the runtime knows.
 */
export function buildPostingTimes(posts: Post[], timeZone: string, now: Date = new Date()): PostingTimes {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let datedCount = 0;
  let skippedNoDate = 0;

  for (const post of posts) {
    const time = readPostedAt(post.postedAt, now.getTime());
    if (time === null) {
      skippedNoDate += 1;
      continue;
    }
    const parts = formatter.formatToParts(time);
    const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "";
    const hourText = parts.find((part) => part.type === "hour")?.value ?? "";
    const weekday = WEEKDAY_INDEX[weekdayName];
    if (weekday === undefined) {
      throw new Error(`Unexpected weekday from Intl formatter: "${weekdayName}"`);
    }
    // The % guards against an engine that reports midnight as 24 despite h23.
    const hour = Number.parseInt(hourText, 10) % 24;
    grid[weekday][hour] += 1;
    datedCount += 1;
  }

  return { grid, datedCount, skippedNoDate, timeZone };
}

/**
 * Sums each run of `bandHours` consecutive hours into one column. Returns 7 rows
 * with `24 / bandHours` columns each. `bandHours` must divide 24.
 */
export function groupHoursIntoBands(grid: number[][], bandHours: number): number[][] {
  if (!Number.isInteger(bandHours) || bandHours <= 0 || 24 % bandHours !== 0) {
    throw new RangeError(`bandHours must divide 24, got ${bandHours}`);
  }
  return grid.map((row) => {
    const bands = Array<number>(24 / bandHours).fill(0);
    row.forEach((count, hour) => {
      bands[Math.floor(hour / bandHours)] += count;
    });
    return bands;
  });
}

/** Label for one band, e.g. band 6 of 3-hour bands is "18–21" short and "18:00–21:00" long. */
export function bandRange(index: number, bandHours: number): { short: string; long: string } {
  const start = index * bandHours;
  const end = start + bandHours;
  const two = (hour: number) => String(hour).padStart(2, "0");
  return {
    short: `${two(start)}–${two(end)}`,
    long: `${two(start)}:00–${two(end)}:00`,
  };
}

/** The cell with the highest count, or null when every cell is zero. Ties keep the earliest cell. */
export function findBusiestCell(grid: number[][]): BusiestCell | null {
  let best: BusiestCell | null = null;
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[row].length; column += 1) {
      const count = grid[row][column];
      if (count === 0) continue;
      if (best === null || count > best.count) {
        best = { row, column, count, tied: 1 };
      } else if (count === best.count) {
        best.tied += 1;
      }
    }
  }
  return best;
}

/**
 * Opacity for a heat cell relative to the busiest cell. Zero stays transparent.
 * Any other count runs linearly from 0.25 up to 1, so a faint cell is still visible.
 */
export function heatOpacity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return 0.25 + 0.75 * (Math.min(count, max) / max);
}
