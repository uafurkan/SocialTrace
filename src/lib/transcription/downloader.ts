import { runApifyActor } from "@/lib/providers/apify/client";
import type { TranscriptPlatform } from "./types";

/**
 * Universal download step (docs/TRANSCRIBER.md architecture): one yt-dlp-
 * based actor covers all four platforms with one input/output shape,
 * instead of maintaining a platform-specific normalizer for each. Output
 * shape confirmed live against a real public TikTok video this session:
 * `{ title, duration, uploader, platform, media: { url, contentType } }`.
 */
const DOWNLOADER_ACTOR_ID = "reinventingai~video-or-audio-downloader";

interface DownloaderResult {
  title?: string;
  duration?: number;
  uploader?: string;
  platform?: string;
  media?: { url?: string; contentType?: string };
  error?: string;
}

export interface DownloadedAudio {
  audioUrl: string;
  durationSeconds: number;
  title: string;
}

/** Returns `null` for a clean "this actor couldn't reach it" result (private/deleted/geo-blocked) — the caller decides whether that's fatal or worth a fallback actor. */
export async function downloadAudio(sourceUrl: string, _platform: TranscriptPlatform): Promise<DownloadedAudio | null> {
  const items = (await runApifyActor(DOWNLOADER_ACTOR_ID, {
    url: sourceUrl,
    format: "audio",
  })) as DownloaderResult[];

  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.error || !item.media?.url) return null;

  // Confirmed live: the actor's key-value-store media URL 403s without the
  // Apify token — it's not a public asset URL despite looking like one.
  const token = process.env.APIFY_API_TOKEN;
  const audioUrl = token ? `${item.media.url}?token=${encodeURIComponent(token)}` : item.media.url;

  return {
    audioUrl,
    durationSeconds: item.duration ?? 0,
    title: item.title ?? "",
  };
}
