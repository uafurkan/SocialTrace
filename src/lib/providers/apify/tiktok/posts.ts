import type { Post } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "../client";

const PROFILE_ACTOR_ID = "clockworks~tiktok-profile-scraper";

interface TikTokVideoItem {
  id: string;
  text?: string;
  webVideoUrl?: string;
  createTimeISO?: string;
  diggCount?: number;
  commentCount?: number;
  playCount?: number;
  videoMeta?: { coverUrl?: string };
  mediaUrls?: string[];
}

/**
 * Every TikTok upload is a video — there's no separate "reels" concept the
 * way Instagram has photo posts vs. reels, so this feeds both `getPosts`
 * and `getReels` in index.ts (capabilities.reels is set false there
 * instead, since a duplicate tab would just show the same list twice).
 */
export async function fetchApifyTikTokPosts(username: string, profileId: string, limit: number): Promise<Post[]> {
  const items = await withDataCache(`posts:${profileId}`, async () => {
    const result = (await runApifyActor(PROFILE_ACTOR_ID, {
      profiles: [username],
      resultsPerPage: limit,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    })) as TikTokVideoItem[];
    return Array.isArray(result) ? result : [];
  });

  return items.map((item) => ({
    id: `${profileId}_post_${item.id}`,
    profileId,
    mediaType: "video" as const,
    thumbnailUrl: item.videoMeta?.coverUrl ?? "",
    mediaUrl: item.mediaUrls?.[0] ?? item.webVideoUrl ?? "",
    permalink: item.webVideoUrl ?? "",
    caption: item.text ?? "",
    likeCount: item.diggCount ?? 0,
    commentCount: item.commentCount ?? 0,
    viewCount: item.playCount ?? null,
    postedAt: item.createTimeISO ?? new Date().toISOString(),
  }));
}
