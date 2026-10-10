import type { Comment } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "../client";
import { toPostedAt } from "../../post-date";

const COMMENTS_ACTOR_ID = "apify~facebook-comments-scraper";

interface FacebookCommentItem {
  id?: string;
  text?: string;
  likesCount?: number;
  date?: string;
  profileUrl?: string;
  profilePicture?: string;
  facebookName?: string;
}

/** Cached per (platform, permalink, limit) for the engagement TTL; see apify/likers.ts for why. */
export async function fetchApifyFacebookComments(permalink: string, limit = 50): Promise<Comment[]> {
  return withDataCache(`engagement:comments:facebook:${permalink}:${limit}`, async () => {
    const items = (await runApifyActor(COMMENTS_ACTOR_ID, {
      startUrls: [{ url: permalink }],
      resultsLimit: limit,
    })) as FacebookCommentItem[];

    if (!Array.isArray(items)) return [];

    return items.map((item, i) => ({
      id: item.id ?? `comment_${i}`,
      authorUsername: item.facebookName ?? "",
      authorAvatarUrl: item.profilePicture ?? "",
      authorIsVerified: false,
      text: item.text ?? "",
      likeCount: item.likesCount ?? 0,
      postedAt: toPostedAt(item.date),
    }));
  });
}
