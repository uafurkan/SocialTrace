import type { Post } from "@/lib/domain/types";

const MS_PER_DAY = 86_400_000;

export interface PostInsights {
  sampleSize: number;
  avgLikes: number;
  medianLikes: number;
  avgComments: number;
  medianComments: number;
  avgViews: number | null;
  /** Average gap in days between consecutive dated posts, or null when fewer than two posts have a valid date. */
  daysBetweenPosts: number | null;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Stats over the posts already loaded on a profile page. Everything here is
 * derived from the same Post rows the grid shows, so it adds no provider calls
 * and describes only the sample, never the whole account.
 */
export function computePostInsights(posts: Post[]): PostInsights {
  const likes = posts.map((post) => post.likeCount);
  const comments = posts.map((post) => post.commentCount);
  const views = posts.flatMap((post) => (post.viewCount == null ? [] : [post.viewCount]));
  const times = posts
    .map((post) => Date.parse(post.postedAt))
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
  const daysBetweenPosts = times.length >= 2 ? (times[times.length - 1] - times[0]) / (times.length - 1) / MS_PER_DAY : null;

  return {
    sampleSize: posts.length,
    avgLikes: mean(likes),
    medianLikes: median(likes),
    avgComments: mean(comments),
    medianComments: median(comments),
    avgViews: views.length > 0 ? mean(views) : null,
    daysBetweenPosts,
  };
}

/** Case-insensitive caption search. A blank query keeps every post. */
export function filterPostsByCaption(posts: Post[], query: string): Post[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter((post) => post.caption.toLowerCase().includes(needle));
}
