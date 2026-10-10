import type { Post } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "./client";
import { toPostedAt } from "../post-date";

const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";

interface ApifyPostItem {
  id: string;
  type?: string; // "Image" | "Video" | "Sidecar"
  displayUrl?: string;
  videoUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  timestamp?: string;
  url?: string;
  shortCode?: string;
}

interface ApifyProfileWithPosts {
  id: string;
  username: string;
  latestPosts?: ApifyPostItem[];
}

/**
 * The Apify actor is the only source here. The actor cannot tell reels from
 * ordinary videos and settles for `type === "Video"` (documented as
 * best-effort in docs/KNOWN_LIMITATIONS.md).
 *
 * The result sits inside `withDataCache`, so it is cached and not re-fetched
 * on the next request.
 */
export async function fetchApifyPosts(username: string, profileId: string): Promise<Post[]> {
  // `posts:v2:` namespace, same as postsCacheKey in data-cache.ts: the old
  // `posts:` rows hold made-up dates and must not be served.
  return withDataCache(`posts:v2:${profileId}`, () => fetchApifyPostsUncached(username, profileId));
}

async function fetchApifyPostsUncached(username: string, profileId: string): Promise<Post[]> {
  const items = (await runApifyActor(PROFILE_ACTOR_ID, { usernames: [username] })) as ApifyProfileWithPosts[];
  const item = Array.isArray(items) ? items[0] : undefined;
  const posts = item?.latestPosts ?? [];

  return posts.map((post, index) => ({
    id: `${profileId}_post_${post.id ?? index}`,
    profileId,
    mediaType: post.type === "Video" ? "video" : "image",
    thumbnailUrl: post.displayUrl ?? "",
    mediaUrl: post.type === "Video" ? post.videoUrl || post.displayUrl || "" : post.displayUrl ?? "",
    permalink: post.url ?? (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ""),
    caption: post.caption ?? "",
    likeCount: post.likesCount ?? 0,
    commentCount: post.commentsCount ?? 0,
    viewCount: post.videoViewCount ?? null,
    postedAt: toPostedAt(post.timestamp),
  }));
}
