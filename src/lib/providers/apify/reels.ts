import type { Post } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "./client";

const REEL_ACTOR_ID = "apify~instagram-reel-scraper";

interface ApifyReelItem {
  id: string;
  displayUrl?: string;
  videoUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoPlayCount?: number;
  videoViewCount?: number;
  timestamp?: string;
  url?: string;
  shortCode?: string;
  /**
   * Set (e.g. "restricted_page") when the actor could only get partial/
   * stale data for this item — observed live for a private account,
   * where it still returned old cached video/caption content alongside
   * this flag instead of a clean empty result. Not something to render:
   * a private account's reels aren't reliably public data (spec §1.2),
   * so these are filtered out rather than shown.
   */
  error?: string;
}

/** Dedicated reels dataset (not approximated from the profile actor's recent posts). */
export async function fetchApifyReels(username: string, profileId: string, limit: number): Promise<Post[]> {
  return withDataCache(`reels:${profileId}:${limit}`, async () => {
    const items = (await runApifyActor(REEL_ACTOR_ID, {
      username: [username],
      resultsLimit: limit,
    })) as ApifyReelItem[];

    if (!Array.isArray(items)) return [];

    return items
      .filter((reel) => !reel.error)
      .map((reel, index) => ({
        id: `${profileId}_reel_${reel.id ?? index}`,
        profileId,
        mediaType: "reel" as const,
        thumbnailUrl: reel.displayUrl ?? "",
        mediaUrl: reel.videoUrl || reel.displayUrl || "",
        permalink: reel.url ?? (reel.shortCode ? `https://www.instagram.com/reel/${reel.shortCode}/` : ""),
        caption: reel.caption ?? "",
        likeCount: reel.likesCount ?? 0,
        commentCount: reel.commentsCount ?? 0,
        viewCount: reel.videoPlayCount ?? reel.videoViewCount ?? null,
        postedAt: reel.timestamp ?? new Date().toISOString(),
      }));
  });
}
