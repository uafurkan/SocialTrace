import type { Post } from "@/lib/domain/types";
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
}

/** Per-process cache, keyed by profile+requested count, so re-paginating doesn't re-run (and re-bill) the actor. */
const reelsCache = new Map<string, Post[]>();

/** Dedicated reels dataset (not approximated from the profile actor's recent posts). */
export async function fetchApifyReels(username: string, profileId: string, limit: number): Promise<Post[]> {
  const cacheKey = profileId;
  const cached = reelsCache.get(cacheKey);
  if (cached && cached.length >= limit) return cached;

  const items = (await runApifyActor(REEL_ACTOR_ID, {
    username: [username],
    resultsLimit: limit,
  })) as ApifyReelItem[];

  if (!Array.isArray(items)) return cached ?? [];

  const mapped: Post[] = items.map((reel, index) => ({
    id: `${profileId}_reel_${reel.id ?? index}`,
    profileId,
    mediaType: "reel",
    thumbnailUrl: reel.displayUrl ?? "",
    mediaUrl: reel.videoUrl || reel.displayUrl || "",
    caption: reel.caption ?? "",
    likeCount: reel.likesCount ?? 0,
    commentCount: reel.commentsCount ?? 0,
    viewCount: reel.videoPlayCount ?? reel.videoViewCount ?? null,
    postedAt: reel.timestamp ?? new Date().toISOString(),
  }));

  reelsCache.set(cacheKey, mapped);
  return mapped;
}
