import type { Comment } from "@/lib/domain/types";
import { runApifyActor } from "./client";

/**
 * apify/instagram-comment-scraper — Apify's own official actor (9M+ runs),
 * verified live during development against a real public post: takes a
 * post/reel permalink, returns comment text, author, timestamp, and like
 * count, no login required.
 */
const COMMENTS_ACTOR_ID = "apify~instagram-comment-scraper";
const DEFAULT_LIMIT = 30;

interface ApifyCommentItem {
  id?: string;
  text?: string;
  ownerUsername?: string;
  ownerProfilePicUrl?: string;
  timestamp?: string;
  likesCount?: number;
  owner?: { is_verified?: boolean };
}

export async function fetchApifyComments(permalink: string, limit = DEFAULT_LIMIT): Promise<Comment[]> {
  const raw = await runApifyActor(COMMENTS_ACTOR_ID, { directUrls: [permalink], resultsLimit: limit });
  if (!Array.isArray(raw)) return [];

  return (raw as ApifyCommentItem[]).slice(0, limit).map((item, index) => ({
    id: item.id ?? `${permalink}_comment_${index}`,
    authorUsername: item.ownerUsername ?? "unknown",
    authorAvatarUrl: item.ownerProfilePicUrl ?? "",
    authorIsVerified: item.owner?.is_verified ?? false,
    text: item.text ?? "",
    likeCount: item.likesCount ?? 0,
    postedAt: item.timestamp ?? new Date().toISOString(),
  }));
}
