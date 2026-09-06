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
  // The token-bearing URL is only ever fetched server-side (Whisper reads
  // audioUrl) — it must never be handed to the browser as videoUrl, or
  // every visitor's "watch while it transcribes" player would leak this
  // project's Apify API token in the page's own network tab/HTML. Found
  // live while wiring up the new YouTube actor below (same bug, this
  // pre-existing TikTok fallback path had it too) — an attacker reading
  // it could run up billing or reach other private data on the account.
  const mediaUrl = token ? `${item.media.url}?token=${encodeURIComponent(token)}` : item.media.url;
  return { audioUrl: mediaUrl, videoUrl: token ? null : mediaUrl, durationSeconds: item.duration ?? 0, title: item.title ?? "" };
}

interface YouTubeItem {
  downloadedFileUrl?: string;
  audioOnlyUrl?: string;
  fileKey?: string;
  durationSeconds?: number;
}

interface YouTubeFastItem {
  status?: string;
  error?: string | null;
  output?: { url?: string };
  durationSeconds?: number;
}

/**
 * New primary YouTube actor, found by researching+benchmarking faster
 * alternatives to `streamers/youtube-video-downloader` (this project's
 * only YouTube path until now). Confirmed live, same video, head-to-head:
 * streamers took 60.4s, epctex took 21.0s — ~2.9x faster — and epctex's
 * 1.37M total runs (vs. streamers' 398K) make it the more battle-tested
 * of the two, not just the faster one. "360" quality is intentional:
 * this pipeline only ever needs audio for Whisper, so the smallest
 * quality that still has an audio track minimizes both download time and
 * the actor's per-second cost. Also simpler and more robust than
 * `streamers`, which can return an HLS manifest URL for `audioOnlyUrl`
 * (not a single fetchable file) rather than always giving a plain
 * `downloadedFileUrl` — epctex's `output.url` is always a direct,
 * already-muxed .mp4 in Apify's own key-value store.
 */
const YOUTUBE_FAST_ACTOR_ID = "epctex~youtube-video-downloader";

async function downloadYouTubeFast(sourceUrl: string): Promise<DownloadedAudio | null> {
  const items = (await runApifyActor(YOUTUBE_FAST_ACTOR_ID, {
    startUrls: [sourceUrl],
    quality: "360",
    storageType: "apify",
  })) as YouTubeFastItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.status !== "succeeded" || item.error || !item.output?.url) return null;

  // This actor's Apify key-value-store output requires the API token to
  // fetch (confirmed live: 403 without it, 200 with) — same as the TikTok
  // fallback actor's media.url above, unlike `streamers`'s output which
  // doesn't need one. That token must never reach the browser (see the
  // comment on the TikTok path above) — audioUrl keeps it for Whisper's
  // server-side fetch, videoUrl drops to null so the live-preview player
  // simply doesn't render for this path instead of leaking it.
  const token = process.env.APIFY_API_TOKEN;
  const mediaUrl = token ? `${item.output.url}?token=${encodeURIComponent(token)}` : item.output.url;
  return { audioUrl: mediaUrl, videoUrl: token ? null : mediaUrl, durationSeconds: item.durationSeconds ?? 0, title: "" };
}

async function downloadYouTube(sourceUrl: string): Promise<DownloadedAudio | null> {
  const fast = await downloadYouTubeFast(sourceUrl);
  if (fast) return fast;

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

/**
 * Free, no-auth, no-Apify-spend primary path for Instagram, discovered by
 * testing live this session: Instagram's own public embed page
 * (`/reel/{code}/embed/captioned/`) is reachable from a plain, unauthenticated
 * request — unlike the raw yt-dlp/graphql paths this project already found
 * blocked — and its HTML inlines a direct, CORS-open CDN `.mp4` URL plus a
 * real `video_duration` in its JSON-in-script payload. Confirmed live
 * against three real reels: ~0.8-1s per fetch, vs. ~35-54s for the
 * `thenetaji` Apify actor below, and a real duration for the first time
 * (that actor never returns one). `null` (not thrown) on any failure —
 * private/deleted reels, or Instagram changing this markup — so the
 * caller falls through to the paid actor, same pattern as TikTok's
 * `downloadTikTokFree`.
 */
function extractInstagramShortcode(sourceUrl: string): string | null {
  const match = sourceUrl.match(/instagram\.com\/(?:reel|p|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

async function downloadInstagramFree(sourceUrl: string): Promise<DownloadedAudio | null> {
  const code = extractInstagramShortcode(sourceUrl);
  if (!code) return null;

  try {
    const res = await fetch(`https://www.instagram.com/reel/${encodeURIComponent(code)}/embed/captioned/`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Instagram inlines this as a JSON string within an already-escaped
    // JSON blob (confirmed live: the literal bytes are `\"video_url\"`,
    // backslash-escaped quotes, not plain `"video_url"`) — search for the
    // unquoted key first, then strip backslashes before matching the value.
    const idx = html.indexOf("video_url");
    if (idx === -1) return null;
    const clean = html.slice(idx, idx + 2000).replace(/\\/g, "");
    const urlMatch = clean.match(/^video_url":"(https:\/\/[^"]+)"/);
    if (!urlMatch) return null;

    const durationMatch = html.match(/video_duration\\?":([0-9.]+)/);
    const duration = durationMatch ? Number.parseFloat(durationMatch[1]) : 0;

    return { audioUrl: urlMatch[1], videoUrl: urlMatch[1], durationSeconds: duration, title: "" };
  } catch {
    return null;
  }
}

async function downloadInstagram(sourceUrl: string): Promise<DownloadedAudio | null> {
  const free = await downloadInstagramFree(sourceUrl);
  if (free) return free;

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

/**
 * Free, no-auth, no-Apify-spend primary path for Facebook — the same
 * discovery as Instagram's embed path above, applied to Facebook's public
 * video embed plugin (`/plugins/video.php?href=<original url>`), which
 * proxies whatever URL shape the user pasted (watch/?v=, /videos/,
 * /reel/, share links) without needing to parse an ID ourselves. Confirmed
 * live: returns a direct, CORS-open `.mp4` (`hd_src`, falling back to
 * `sd_src`) in under a second, vs. the `apple_yang` Apify actor's
 * 30-40s+. No duration field found in this payload — left honest at 0,
 * same as the Apify actor already did when it had no duration either.
 */
async function downloadFacebookFree(sourceUrl: string): Promise<DownloadedAudio | null> {
  try {
    const res = await fetch(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(sourceUrl)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    for (const key of ["hd_src", "sd_src"]) {
      const idx = html.indexOf(key);
      if (idx === -1) continue;
      const clean = html.slice(idx, idx + 2000).replace(/\\/g, "");
      const match = clean.match(/^\w+":"(https:\/\/[^"]+)"/);
      if (match) return { audioUrl: match[1], videoUrl: match[1], durationSeconds: 0, title: "" };
    }
    return null;
  } catch {
    return null;
  }
}

async function downloadFacebook(sourceUrl: string): Promise<DownloadedAudio | null> {
  const free = await downloadFacebookFree(sourceUrl);
  if (free) return free;

  const items = (await runApifyActor(FACEBOOK_ACTOR_ID, { videoUrls: [sourceUrl] })) as FacebookItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.errMsg || (!item.audioUrl && !item.videoUrl)) return null;

  // This actor returns "" (not null/undefined) for audioUrl when there's no
  // separate audio track — confirmed live, so `??` alone would silently keep
  // the empty string instead of falling back to videoUrl.
  const audioUrl = item.audioUrl || item.videoUrl;
  if (!audioUrl) return null;

  return {
    audioUrl,
    videoUrl: item.videoUrl || null,
    durationSeconds: item.duration ?? 0,
    title: item.title ?? "",
  };
}

/**
 * Returns `null` for a clean "this actor couldn't reach it" result
 * (private/deleted/geo-blocked) — the caller decides whether that's fatal
 * or worth a fallback actor.
 *
 * Rounds `durationSeconds` here, once, for every platform: `transcript_
 * cache.duration_seconds` is an `integer` column, but at least one actor
 * (Facebook's `apple_yang` actor, confirmed live) returns a fractional
 * value (e.g. `74.304`) — writing that straight to Postgres throws
 * `invalid input syntax for type integer`, which previously meant a
 * *successful* download+transcription still failed the whole request at
 * the final DB write, discarding a completed (and already paid-for)
 * pipeline run. Rounding at this single boundary, rather than inside each
 * platform's function, means a future actor with the same quirk can't
 * reintroduce the bug.
 */
export async function downloadAudio(sourceUrl: string, platform: TranscriptPlatform): Promise<DownloadedAudio | null> {
  const result = await downloadAudioUnrounded(sourceUrl, platform);
  return result ? { ...result, durationSeconds: Math.round(result.durationSeconds) } : null;
}

async function downloadAudioUnrounded(sourceUrl: string, platform: TranscriptPlatform): Promise<DownloadedAudio | null> {
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
