import type { Post } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { fetchWebProfileInfo, toPosts } from "../instagram-public/web-profile-info";
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
  url?: string;
  shortCode?: string;
}

interface ApifyProfileWithPosts {
  id: string;
  username: string;
  latestPosts?: ApifyPostItem[];
}

/**
 * Source chain, same order and reasoning as fetchApifyProfile: the free
 * public endpoint first, the paid actor second.
 *
 * The free response also has better fidelity here — it carries Instagram's own
 * `product_type` field, so reels are identified rather than guessed at. The
 * Apify path below can't distinguish reels from ordinary videos and settles
 * for `type === "Video"` (documented as best-effort in
 * docs/KNOWN_LIMITATIONS.md), which is why the two branches return posts
 * mapped by different code rather than sharing one mapper.
 *
 * Both branches sit inside `withDataCache`, so whichever source answers, the
 * result is cached identically and neither is re-fetched on the next request.
 */
export async function fetchApifyPosts(username: string, profileId: string): Promise<Post[]> {
  return withDataCache(`posts:${profileId}`, async () => {
    const publicUser = await fetchWebProfileInfo(username);
    if (publicUser) {
      return toPosts(publicUser, profileId);
    }
    return fetchApifyPostsUncached(username, profileId);
  });
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
    postedAt: post.timestamp ?? new Date().toISOString(),
  }));
}
