import type { Story } from "@/lib/domain/types";
import { runApifyActor } from "./client";

/**
 * data-slayer/instagram-stories-scraper ("No Login") — verified live during
 * development against real active stories (docs/DECISIONS.md): takes public
 * usernames, returns raw Instagram Stories API records (image_versions /
 * video_versions, taken_at / expiring_at as unix seconds) with no session
 * cookie required. A username with nothing active comes back as a single
 * `{ username, status: "no_active_stories" }` record instead of a story
 * item — that's the honest "no stories right now" case, not a failure.
 */
const STORIES_ACTOR_ID = "data-slayer~instagram-stories-scraper";

interface ApifyImageVersion {
  url?: string;
  width?: number;
}

interface ApifyVideoVersion {
  url?: string;
  width?: number;
}

interface ApifyStoryItem {
  id?: string;
  is_video?: boolean;
  taken_at?: number;
  expiring_at?: number;
  image_versions?: { items?: ApifyImageVersion[] };
  video_versions?: ApifyVideoVersion[];
  status?: string;
}

function widest<T extends { url?: string; width?: number }>(versions: T[] | undefined): string {
  if (!versions || versions.length === 0) return "";
  return [...versions].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? "";
}

function isStoryItem(item: ApifyStoryItem): boolean {
  return typeof item.id === "string" && item.status !== "no_active_stories";
}

export async function fetchApifyStories(username: string, profileId: string): Promise<Story[]> {
  const raw = await runApifyActor(STORIES_ACTOR_ID, { usernames: [username] });
  if (!Array.isArray(raw)) return [];

  return (raw as ApifyStoryItem[]).filter(isStoryItem).map((item, index) => {
    const isVideo = item.is_video === true;
    const image = widest(item.image_versions?.items);
    const video = widest(item.video_versions);
    const mediaUrl = isVideo ? video || image : image;
    const takenAtMs = (item.taken_at ?? Math.floor(Date.now() / 1000)) * 1000;
    const expiringAtMs = (item.expiring_at ?? Math.floor(Date.now() / 1000) + 24 * 60 * 60) * 1000;

    return {
      id: `${profileId}_story_${item.id ?? index}`,
      profileId,
      mediaType: isVideo ? "video" : "image",
      mediaUrl,
      thumbnailUrl: image || mediaUrl,
      postedAt: new Date(takenAtMs).toISOString(),
      expiresAt: new Date(expiringAtMs).toISOString(),
    };
  });
}
