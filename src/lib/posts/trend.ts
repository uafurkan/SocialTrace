import type { Post } from "@/lib/domain/types";

const MS_PER_DAY = 86_400_000;
/** Spans of this many days or more are bucketed by calendar month; shorter spans by ISO week. */
const MONTHLY_SPAN_DAYS = 90;
/**
 * A date more than this after `now` is treated as unknown. The allowance covers a
 * clock that runs slightly behind; a post dated days ahead is bad source data.
 */
const FUTURE_ALLOWANCE_MS = MS_PER_DAY;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type TrendGranularity = "week" | "month";

export interface TrendBucket {
  /** Readable label, e.g. "Jan 5, 2026" for a week start or "Jan 2026" for a month. */
  label: string;
  /** UTC start of the bucket as YYYY-MM-DD: the Monday of an ISO week, or the 1st of a month. */
  start: string;
  count: number;
  /** Mean likes over posts in the bucket with a finite like count; null when there is none. */
  avgLikes: number | null;
  /** Mean comments over posts in the bucket with a finite comment count; null when there is none. */
  avgComments: number | null;
}

export interface PostTrend {
  /** null when no post has a usable date, so there are no buckets at all. */
  granularity: TrendGranularity | null;
  /** Continuous from the first to the last bucket; empty stretches appear with count 0. */
  buckets: TrendBucket[];
  datedCount: number;
  /** Posts with a null, unparseable, or future date. These are never placed anywhere. */
  skippedNoDate: number;
}

interface DatedPost {
  time: number;
  likes: number | null;
  comments: number | null;
}

/**
 * Reads a post's date as epoch milliseconds. Returns null for a missing, unparseable,
 * or implausibly future date, so the caller skips the post instead of guessing a time.
 * Shared with the posting-time grid so both panels count the same posts.
 */
export function readPostedAt(postedAt: string | null, now: number): number | null {
  if (postedAt == null) return null;
  const time = Date.parse(postedAt);
  if (Number.isNaN(time) || time > now + FUTURE_ALLOWANCE_MS) return null;
  return time;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

/** Monday 00:00 UTC of the ISO week containing `time`. */
function startOfIsoWeek(time: number): number {
  const date = new Date(time);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
}

/** 00:00 UTC on the 1st of the calendar month containing `time`. */
function startOfMonth(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function nextBucketStart(start: number, granularity: TrendGranularity): number {
  if (granularity === "week") return start + 7 * MS_PER_DAY;
  const date = new Date(start);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function bucketLabel(start: number, granularity: TrendGranularity): string {
  const date = new Date(start);
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return granularity === "month" ? `${month} ${year}` : `${month} ${date.getUTCDate()}, ${year}`;
}

/**
 * Groups the loaded posts that have a usable date into UTC buckets. Spans of 90 days
 * or more use calendar months; shorter spans use ISO weeks. Averages cover only the
 * posts in the bucket, and posts without a usable date are counted, never bucketed.
 */
export function buildPostTrend(posts: Post[], now: Date = new Date()): PostTrend {
  const nowMs = now.getTime();
  const dated: DatedPost[] = [];
  let skippedNoDate = 0;
  for (const post of posts) {
    const time = readPostedAt(post.postedAt, nowMs);
    if (time === null) {
      skippedNoDate += 1;
      continue;
    }
    dated.push({ time, likes: finiteOrNull(post.likeCount), comments: finiteOrNull(post.commentCount) });
  }

  if (dated.length === 0) {
    return { granularity: null, buckets: [], datedCount: 0, skippedNoDate };
  }

  const earliest = Math.min(...dated.map((entry) => entry.time));
  const latest = Math.max(...dated.map((entry) => entry.time));
  const granularity: TrendGranularity = latest - earliest >= MONTHLY_SPAN_DAYS * MS_PER_DAY ? "month" : "week";
  const bucketStartOf = granularity === "month" ? startOfMonth : startOfIsoWeek;

  const membersByStart = new Map<number, DatedPost[]>();
  for (const entry of dated) {
    const key = bucketStartOf(entry.time);
    const members = membersByStart.get(key);
    if (members) members.push(entry);
    else membersByStart.set(key, [entry]);
  }

  const buckets: TrendBucket[] = [];
  const lastStart = bucketStartOf(latest);
  for (let start = bucketStartOf(earliest); start <= lastStart; start = nextBucketStart(start, granularity)) {
    const members = membersByStart.get(start) ?? [];
    buckets.push({
      label: bucketLabel(start, granularity),
      start: new Date(start).toISOString().slice(0, 10),
      count: members.length,
      avgLikes: mean(members.map((entry) => entry.likes)),
      avgComments: mean(members.map((entry) => entry.comments)),
    });
  }

  return { granularity, buckets, datedCount: dated.length, skippedNoDate };
}
