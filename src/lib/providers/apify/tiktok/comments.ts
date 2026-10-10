import type { Comment } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "../client";
import { toPostedAt } from "../../post-date";

const COMMENTS_ACTOR_ID = "clockworks~tiktok-comments-scraper";

interface TikTokCommentItem {
  cid?: string;
  text?: string;
  diggCount?: number;
  uniqueId?: string;
  avatarThumbnail?: string;
  createTimeISO?: string;
}

/** Cached per (platform, permalink, limit) for the engagement TTL; see apify/likers.ts for why. */
export async function fetchApifyTikTokComments(permalink: string, limit = 50): Promise<Comment[]> {
  return withDataCache(`engagement:comments:tiktok:${permalink}:${limit}`, async () => {
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
      postedAt: toPostedAt(item.createTimeISO),
    }));
  });
}
