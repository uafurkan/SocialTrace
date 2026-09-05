import type { Post } from "@/lib/domain/types";
import { runApifyActor } from "./client";

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
}

interface ApifyProfileWithPosts {
  id: string;
  username: string;
  latestPosts?: ApifyPostItem[];
}

/**
 * The profile-scraper actor is the only one that returns recent posts, so
 * this re-calls it (results include `latestPosts`) rather than needing a
 * dedicated posts actor. `latestPosts` doesn't distinguish reels from
 * regular videos, so `mediaType === "reel"` is approximated as
 * `type === "Video"` — documented as best-effort in docs/KNOWN_LIMITATIONS.md.
 */
export async function fetchApifyPosts(username: string, profileId: string): Promise<Post[]> {
  const items = (await runApifyActor(PROFILE_ACTOR_ID, { usernames: [username] })) as ApifyProfileWithPosts[];
  const item = Array.isArray(items) ? items[0] : undefined;
  const posts = item?.latestPosts ?? [];

  return posts.map((post, index) => ({
    id: `${profileId}_post_${post.id ?? index}`,
    profileId,
    mediaType: post.type === "Video" ? "video" : "image",
    thumbnailUrl: post.displayUrl ?? "",
    mediaUrl: post.type === "Video" ? post.videoUrl || post.displayUrl || "" : post.displayUrl ?? "",
    caption: post.caption ?? "",
    likeCount: post.likesCount ?? 0,
    commentCount: post.commentsCount ?? 0,
    viewCount: post.videoViewCount ?? null,
    postedAt: post.timestamp ?? new Date().toISOString(),
  }));
}
