import type { Comment } from "@/lib/domain/types";
import { runApifyActor } from "../client";

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

export async function fetchApifyFacebookComments(permalink: string, limit = 50): Promise<Comment[]> {
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
    postedAt: item.date ?? new Date().toISOString(),
  }));
}
