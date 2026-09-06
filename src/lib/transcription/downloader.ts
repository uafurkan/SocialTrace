import { runApifyActor } from "@/lib/providers/apify/client";
import type { TranscriptPlatform } from "./types";

/**
 * Per-platform download chain (docs/TRANSCRIBER.md architecture).
 *
 * A single yt-dlp-based "universal" actor was tried first
 * (`reinventingai/video-or-audio-downloader`) but as of this build only
 * works reliably for TikTok — YouTube and Instagram now block raw yt-dlp
 * (running from any cloud/datacenter IP, not just Apify's) with a 403 /
 * "login required" error, confirmed live against this exact actor. Each
 * remaining actor/endpoint below was confirmed live this session to
 * actually return a real, playable media URL for a real public video:
 *  - TikTok: **free primary** — tikwm.com, the same unofficial no-auth API
 *    behind most free TikTok-downloader sites; confirmed live, returns a
 *    watermark-free video URL + duration with no Apify spend at all. Falls
 *    back to the yt-dlp actor (still reliable for TikTok) only if tikwm is
 *    ever down.
 *  - YouTube: `streamers/youtube-video-downloader` (398K+ runs) — only
 *    reached when the free captions fast-path (youtube-captions.ts) finds
 *    no captions. Public free alternatives (Piped/Invidious instances)
 *    were tried live this session and were unreliable (401s, empty
 *    responses, dead instances) — not worth trading away "works every
 *    time" for "free," per the project's own reliability requirement.
 *  - Instagram: `thenetaji/instagram-video-downloader` (Reels/Stories) —
 *    no working no-auth free API was found for Instagram this session.
 *  - Facebook: `apple_yang/facebook-video-audio-downloader` — the only
 *    actor found (across two prior sessions of searching) that returns a
 *    direct Facebook CDN media file at all; still no follower/media-file
 *    support elsewhere in the Facebook provider (docs/PROVIDER_CONTRACT.md).
 */
const TIKTOK_ACTOR_ID = "reinventingai~video-or-audio-downloader";
const YOUTUBE_ACTOR_ID = "streamers~youtube-video-downloader";
const INSTAGRAM_ACTOR_ID = "thenetaji~instagram-video-downloader";
const FACEBOOK_ACTOR_ID = "apple_yang~facebook-video-audio-downloader";
const TIKWM_ENDPOINT = "https://www.tikwm.com/api/";

export interface DownloadedAudio {
  /** URL fed to the speech-to-text step — always audio, or an audio+video file Whisper accepts (mp4/webm/m4a are all valid Whisper inputs, not just mp3/wav). */
  audioUrl: string;
  /** A real playable file for the "watch while it transcribes" UI — the same file when the actor only returns one, a smaller video-only file when the actor returns both. */
  videoUrl: string | null;
  durationSeconds: number;
  title: string;
}

interface TikTokItem {
  title?: string;
  duration?: number;
  media?: { url?: string };
  error?: string;
}

interface TikwmResponse {
  code?: number;
  data?: { play?: string; duration?: number; title?: string };
}

/** Free, no-auth, no-Apify-spend primary path for TikTok — see the module doc comment above. `null` (not thrown) on any failure so the caller falls through to the paid actor. */
async function downloadTikTokFree(sourceUrl: string): Promise<DownloadedAudio | null> {
  try {
    const res = await fetch(`${TIKWM_ENDPOINT}?url=${encodeURIComponent(sourceUrl)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialTraceBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TikwmResponse;
    if (json.code !== 0 || !json.data?.play) return null;
    return {
      audioUrl: json.data.play,
      videoUrl: json.data.play,
      durationSeconds: json.data.duration ?? 0,
      title: json.data.title ?? "",
    };
  } catch {
    return null;
  }
}

async function downloadTikTok(sourceUrl: string): Promise<DownloadedAudio | null> {
  const free = await downloadTikTokFree(sourceUrl);
  if (free) return free;

  const items = (await runApifyActor(TIKTOK_ACTOR_ID, { url: sourceUrl, format: "video" })) as TikTokItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.error || !item.media?.url) return null;

  const token = process.env.APIFY_API_TOKEN;
  const mediaUrl = token ? `${item.media.url}?token=${encodeURIComponent(token)}` : item.media.url;
  return { audioUrl: mediaUrl, videoUrl: mediaUrl, durationSeconds: item.duration ?? 0, title: item.title ?? "" };
}

interface YouTubeItem {
  downloadedFileUrl?: string;
  audioOnlyUrl?: string;
  fileKey?: string;
  durationSeconds?: number;
}

async function downloadYouTube(sourceUrl: string): Promise<DownloadedAudio | null> {
  const items = (await runApifyActor(YOUTUBE_ACTOR_ID, { videos: [{ url: sourceUrl }] })) as YouTubeItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || !item.downloadedFileUrl) return null;

  const title = (item.fileKey ?? "").replace(/^[\w-]+_/, "").replace(/\.[a-z0-9]+$/i, "") || "";
  return {
    audioUrl: item.downloadedFileUrl,
    videoUrl: item.downloadedFileUrl,
    durationSeconds: item.durationSeconds ?? 0,
    title,
  };
}

interface InstagramItem {
  savedFile?: { url?: string };
  error?: string;
}

async function downloadInstagram(sourceUrl: string): Promise<DownloadedAudio | null> {
  const items = (await runApifyActor(INSTAGRAM_ACTOR_ID, { codes: [sourceUrl] })) as InstagramItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.error || !item.savedFile?.url) return null;

  // No duration field on this actor's output — left at 0 (unknown), which
  // the MAX_VIDEO_DURATION_SECONDS cap in index.ts treats as "don't skip",
  // not "definitely under the limit" (an honest unknown, not a fabricated one).
  return { audioUrl: item.savedFile.url, videoUrl: item.savedFile.url, durationSeconds: 0, title: "" };
}

interface FacebookItem {
  audioUrl?: string;
  videoUrl?: string;
  title?: string;
  duration?: number;
  errMsg?: string;
}

async function downloadFacebook(sourceUrl: string): Promise<DownloadedAudio | null> {
  const items = (await runApifyActor(FACEBOOK_ACTOR_ID, { videoUrls: [sourceUrl] })) as FacebookItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.errMsg || (!item.audioUrl && !item.videoUrl)) return null;

  return {
    audioUrl: item.audioUrl ?? item.videoUrl!,
    videoUrl: item.videoUrl ?? null,
    durationSeconds: item.duration ?? 0,
    title: item.title ?? "",
  };
}

/** Returns `null` for a clean "this actor couldn't reach it" result (private/deleted/geo-blocked) — the caller decides whether that's fatal or worth a fallback actor. */
export async function downloadAudio(sourceUrl: string, platform: TranscriptPlatform): Promise<DownloadedAudio | null> {
  switch (platform) {
    case "tiktok":
      return downloadTikTok(sourceUrl);
    case "youtube":
      return downloadYouTube(sourceUrl);
    case "instagram":
      return downloadInstagram(sourceUrl);
    case "facebook":
      return downloadFacebook(sourceUrl);
  }
}
