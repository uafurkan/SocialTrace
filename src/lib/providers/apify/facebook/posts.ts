import type { Post } from "@/lib/domain/types";
import { runApifyActor } from "../client";

const POSTS_ACTOR_ID = "apify~facebook-posts-scraper";

interface FacebookPostItem {
  postId?: string;
  url?: string;
  text?: string;
  time?: string;
  likes?: number;
  comments?: number;
  isVideo?: boolean;
  viewsCount?: number;
  media?: Array<{ thumbnail?: string }>;
}

/**
 * No actor tested here returns a direct downloadable video file URL for
 * Facebook (only the post's own facebook.com/reel/... permalink) — unlike
 * Instagram/TikTok, so `mediaUrl` here is that permalink, not a raw media
 * file. The profile page's download button is hidden for Facebook posts
 * accordingly (honest gap, not a broken download).
 */
export async function fetchApifyFacebookPosts(usernameOrUrl: string, profileId: string, limit: number): Promise<Post[]> {
  const url = usernameOrUrl.startsWith("http") ? usernameOrUrl : `https://www.facebook.com/${usernameOrUrl}`;
  const items = (await runApifyActor(POSTS_ACTOR_ID, { startUrls: [{ url }], resultsLimit: limit })) as FacebookPostItem[];

  if (!Array.isArray(items)) return [];

  return items.map((item, i) => ({
    id: `${profileId}_post_${item.postId ?? i}`,
    profileId,
    mediaType: item.isVideo ? ("video" as const) : ("image" as const),
    thumbnailUrl: item.media?.[0]?.thumbnail ?? "",
    // Left empty, not item.url: no actor tested here returns a real
    // downloadable media file for Facebook, only the post's own page
    // permalink — setting mediaUrl to that would render a working-looking
    // "Download" button that actually just re-opens the Facebook post.
    // permalink (below) still opens the real post/comments.
    mediaUrl: "",
    permalink: item.url ?? "",
    caption: item.text ?? "",
    likeCount: item.likes ?? 0,
    commentCount: item.comments ?? 0,
    viewCount: item.viewsCount ?? null,
    postedAt: item.time ?? new Date().toISOString(),
  }));
}
