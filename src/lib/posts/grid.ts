import type { Post } from "@/lib/domain/types";

/** "default" keeps the order the posts were loaded in. */
export type PostSortKey = "default" | "views" | "likes" | "comments" | "date";
export type SortDirection = "asc" | "desc";

export interface PostSort {
  key: PostSortKey;
  direction: SortDirection;
}

export const DEFAULT_POST_SORT: PostSort = { key: "default", direction: "desc" };

export const POST_SORT_OPTIONS: ReadonlyArray<{ value: string; label: string; sort: PostSort }> = [
  { value: "default", label: "Default order", sort: DEFAULT_POST_SORT },
  { value: "views-desc", label: "Most views", sort: { key: "views", direction: "desc" } },
  { value: "views-asc", label: "Fewest views", sort: { key: "views", direction: "asc" } },
  { value: "likes-desc", label: "Most likes", sort: { key: "likes", direction: "desc" } },
  { value: "likes-asc", label: "Fewest likes", sort: { key: "likes", direction: "asc" } },
  { value: "comments-desc", label: "Most comments", sort: { key: "comments", direction: "desc" } },
  { value: "comments-asc", label: "Fewest comments", sort: { key: "comments", direction: "asc" } },
  { value: "date-desc", label: "Newest first", sort: { key: "date", direction: "desc" } },
  { value: "date-asc", label: "Oldest first", sort: { key: "date", direction: "asc" } },
];

/** The select value that matches a sort, e.g. "likes-desc". */
export function sortOptionValue(sort: PostSort): string {
  return sort.key === "default" ? "default" : `${sort.key}-${sort.direction}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Epoch milliseconds for postedAt, or null when it is missing or unparseable. */
function postTime(post: Post): number | null {
  if (post.postedAt == null) return null;
  const time = Date.parse(post.postedAt);
  return Number.isNaN(time) ? null : time;
}

const SORT_VALUE: Record<Exclude<PostSortKey, "default">, (post: Post) => number | null> = {
  views: (post) => finiteOrNull(post.viewCount),
  likes: (post) => finiteOrNull(post.likeCount),
  comments: (post) => finiteOrNull(post.commentCount),
  date: postTime,
};

/**
 * Returns a new array; the input is never mutated. Posts with a missing value
 * (null viewCount, null or unparseable postedAt) sort last in both directions.
 * Ties keep their original relative order.
 */
export function sortPosts(posts: Post[], key: PostSortKey, direction: SortDirection): Post[] {
  if (key === "default") return [...posts];
  const read = SORT_VALUE[key];
  const sign = direction === "asc" ? 1 : -1;
  return [...posts].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    if (left === null || right === null) {
      if (left === null && right === null) return 0;
      return left === null ? 1 : -1;
    }
    return sign * (left - right);
  });
}

/** Accepts only a real calendar day written as YYYY-MM-DD. */
function validDay(value: string): string | null {
  if (!ISO_DAY.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return value;
}

/**
 * Local calendar day (YYYY-MM-DD) of a post's date, or null when the date is
 * unknown. This is the day the table's date column shows for the same post.
 */
export function postDayLocal(post: Post): string | null {
  const time = postTime(post);
  if (time === null) return null;
  const date = new Date(time);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when at least one bound is a valid YYYY-MM-DD day. */
export function hasDateFilter(from: string, to: string): boolean {
  return validDay(from) !== null || validDay(to) !== null;
}

/**
 * Keeps posts whose local calendar day falls between `from` and `to`, both
 * inclusive. An empty or invalid bound is open on that side. With no valid
 * bound, every post is returned unchanged, including posts with unknown dates.
 * Once a bound is set, posts with an unknown date are excluded.
 */
export function filterPostsByDate(posts: Post[], from: string, to: string): Post[] {
  const lower = validDay(from);
  const upper = validDay(to);
  if (lower === null && upper === null) return posts;
  return posts.filter((post) => {
    const day = postDayLocal(post);
    if (day === null) return false;
    return (lower === null || day >= lower) && (upper === null || day <= upper);
  });
}

/** How many posts have no usable date, so a date filter cannot place them. */
export function countUndatedPosts(posts: Post[]): number {
  return posts.filter((post) => postDayLocal(post) === null).length;
}
