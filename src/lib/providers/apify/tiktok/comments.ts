import type { Comment } from "@/lib/domain/types";
import { runApifyActor } from "../client";

const COMMENTS_ACTOR_ID = "clockworks~tiktok-comments-scraper";

interface TikTokCommentItem {
  cid?: string;
  text?: string;
  diggCount?: number;
  uniqueId?: string;
  avatarThumbnail?: string;
  createTimeISO?: string;
}

export async function fetchApifyTikTokComments(permalink: string, limit = 50): Promise<Comment[]> {
  const items = (await runApifyActor(COMMENTS_ACTOR_ID, {
    postURLs: [permalink],
    commentsPerPost: limit,
    maxRepliesPerComment: 0,
  })) as TikTokCommentItem[];

  if (!Array.isArray(items)) return [];

  return items.map((item, i) => ({
    id: item.cid ?? `comment_${i}`,
    authorUsername: item.uniqueId ?? "",
    authorAvatarUrl: item.avatarThumbnail ?? "",
    authorIsVerified: false,
    text: item.text ?? "",
    likeCount: item.diggCount ?? 0,
    postedAt: item.createTimeISO ?? new Date().toISOString(),
  }));
}
