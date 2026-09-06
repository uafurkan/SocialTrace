import type { Highlight } from "@/lib/domain/types";
import { withDataCache } from "@/lib/cache/data-cache";
import { runApifyActor } from "./client";

/**
 * seemuapps/instagram-highlights-scraper — verified live during development
 * against real public accounts: takes public usernames, returns one item
 * per highlight reel with its full `stories` array already resolved (no
 * separate call needed per highlight, unlike some competing actors that
 * only return highlight metadata). No login required.
 */
const HIGHLIGHTS_ACTOR_ID = "seemuapps~instagram-highlights-scraper";

interface ApifyHighlightStory {
  id?: string;
  mediaType?: string; // "image" | "video"
  imageUrl?: string;
  videoUrl?: string;
  timestamp?: number;
}

interface ApifyHighlightItem {
  highlightId?: string;
  title?: string;
  coverUrl?: string;
  stories?: ApifyHighlightStory[];
}

export async function fetchApifyHighlights(username: string, profileId: string): Promise<Highlight[]> {
  const raw = await withDataCache(`highlights:${profileId}`, () => runApifyActor(HIGHLIGHTS_ACTOR_ID, { usernames: [username] }));
  if (!Array.isArray(raw)) return [];

  return (raw as ApifyHighlightItem[])
    .filter((h) => typeof h.highlightId === "string")
    .map((h, hIndex) => ({
      id: h.highlightId ?? `${profileId}_highlight_${hIndex}`,
      profileId,
      title: h.title ?? "Highlight",
      coverUrl: h.coverUrl ?? "",
      items: (h.stories ?? []).map((s, sIndex) => {
        const isVideo = s.mediaType === "video";
        return {
          id: s.id ?? `${h.highlightId}_item_${sIndex}`,
          mediaType: (isVideo ? "video" : "image") as "image" | "video",
          mediaUrl: isVideo ? s.videoUrl || s.imageUrl || "" : s.imageUrl || "",
          thumbnailUrl: s.imageUrl || "",
          postedAt: new Date((s.timestamp ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        };
      }),
    }));
}
