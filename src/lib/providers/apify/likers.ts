import type { Liker } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "./client";

/**
 * memo23/instagram-likers-scraper ("No Login") — verified live during
 * development against a real public post: takes a post/reel permalink,
 * returns the accounts that liked it (username, full name, verified/
 * private flags, profile picture) with no session cookie required.
 */
const LIKERS_ACTOR_ID = "memo23~instagram-likers-scraper";
const DEFAULT_LIMIT = 50;

interface ApifyLikerItem {
  username?: string;
  fullName?: string;
  profilePicUrl?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
}

function hasUsername(item: ApifyLikerItem): item is ApifyLikerItem & { username: string } {
  return typeof item.username === "string";
}

/**
 * Cached per (permalink, limit) for the engagement TTL: each miss is one
 * Apify actor run, and reopening the same post's likers modal used to bill
 * again every time. The cache stores the mapped result, so a hit returns
 * exactly what a miss would have returned.
 */
export async function fetchApifyLikers(permalink: string, limit = DEFAULT_LIMIT): Promise<Liker[]> {
  return withDataCache(`engagement:likers:${permalink}:${limit}`, async () => {
    const raw = await runApifyActor(LIKERS_ACTOR_ID, { postUrls: [permalink], resultsLimit: limit });
    if (!Array.isArray(raw)) return [];

    return (raw as ApifyLikerItem[])
      .filter(hasUsername)
      .slice(0, limit)
      .map((item) => ({
        username: item.username,
        displayName: item.fullName || item.username,
        avatarUrl: item.profilePicUrl ?? "",
        isVerified: item.isVerified ?? false,
        isPrivate: item.isPrivate ?? false,
      }));
  });
}
