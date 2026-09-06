import type { TaggedPost } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "./client";

/**
 * instagram-scraper/instagram-tagged-posts-scraper — verified live during
 * development against a real public account (natgeo): returns raw
 * Instagram media records with a real `tagged_user` array (confirmed the
 * target profile actually appears in it, not just echoed input) — no
 * login required.
 */
const TAGGED_POSTS_ACTOR_ID = "instagram-scraper~instagram-tagged-posts-scraper";
const DEFAULT_RESULTS_LIMIT = 24;

interface ApifyTaggedUser {
  username?: string;
}

interface ApifyTaggedPostItem {
  id?: string;
  pk?: string;
  is_video?: boolean;
  video_url?: string;
  image?: string;
  shortcode?: string;
  url?: string;
  caption?: { text?: string } | string | null;
  like_count?: number;
  comment_count?: number;
  taken_at?: number | string;
  tagged_user?: ApifyTaggedUser[];
  user?: { username?: string; profile_pic_url?: string; is_verified?: boolean };
}

function captionText(caption: ApifyTaggedPostItem["caption"]): string {
  if (!caption) return "";
  if (typeof caption === "string") return caption;
  return caption.text ?? "";
}

/** The actor has been observed returning `taken_at` as both a unix-seconds number and an ISO string — handle both rather than assuming one. */
function parseTakenAt(takenAt: number | string | undefined): string {
  if (takenAt == null) return new Date().toISOString();
  const date = typeof takenAt === "number" ? new Date(takenAt * 1000) : new Date(takenAt);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function fetchApifyTaggedPosts(username: string): Promise<TaggedPost[]> {
  const raw = await withDataCache(`tagged:${username.toLowerCase()}`, () =>
    runApifyActor(TAGGED_POSTS_ACTOR_ID, {
      instagramUsernames: [username],
      resultsLimit: DEFAULT_RESULTS_LIMIT,
    }),
  );
  if (!Array.isArray(raw)) return [];

  return (raw as ApifyTaggedPostItem[])
    .filter((item) => (item.tagged_user ?? []).some((u) => u.username?.toLowerCase() === username.toLowerCase()))
    .map((item, index) => {
      const isVideo = item.is_video === true;
      const id = item.pk ?? item.id ?? `${username}_tagged_${index}`;
      return {
        id: String(id),
        mediaType: (isVideo ? "video" : "image") as "image" | "video",
        mediaUrl: isVideo ? item.video_url || item.image || "" : item.image || "",
        thumbnailUrl: item.image ?? "",
        permalink: item.url ?? (item.shortcode ? `https://www.instagram.com/p/${item.shortcode}/` : ""),
        caption: captionText(item.caption),
        likeCount: item.like_count ?? 0,
        commentCount: item.comment_count ?? 0,
        postedAt: parseTakenAt(item.taken_at),
        authorUsername: item.user?.username ?? "unknown",
        authorAvatarUrl: item.user?.profile_pic_url ?? "",
        authorIsVerified: item.user?.is_verified ?? false,
      };
    });
}
