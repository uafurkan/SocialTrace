import type { TranscriptPlatform } from "./types";

/**
 * Fast, local, zero-cost check — the first line of defense against
 * wasting an Apify/Groq call on garbage input (bad-outcome #4,
 * docs/TRANSCRIBER.md). Deliberately permissive on path shape (shorts,
 * reels, watch, share-link redirects, mobile subdomains) since the
 * downstream downloader actor is the real validator of whether a URL
 * resolves to an actual video — this only decides *which* platform to
 * label it as, or reject it outright as unsupported.
 */
const PLATFORM_HOST_PATTERNS: Array<{ platform: TranscriptPlatform; hosts: RegExp }> = [
  { platform: "youtube", hosts: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { platform: "tiktok", hosts: /(^|\.)tiktok\.com$/i },
  { platform: "instagram", hosts: /(^|\.)instagram\.com$/i },
  { platform: "facebook", hosts: /(^|\.)(facebook\.com|fb\.watch)$/i },
];

export function detectPlatform(rawUrl: string): TranscriptPlatform | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  for (const { platform, hosts } of PLATFORM_HOST_PATTERNS) {
    if (hosts.test(url.hostname)) return platform;
  }
  return null;
}

/**
 * Canonical cache key for a link — strips tracking params/fragment so
 * `?si=...`-style share links don't fragment the cache, while keeping
 * whatever query param actually identifies the video.
 *
 * This used to unconditionally drop the whole query string, which is safe
 * for TikTok/Instagram/most Facebook links (the video ID lives in the
 * path), but YouTube's `watch?v=` URLs — and Facebook's `/watch/?v=`
 * links — put the *only* identifying value in the query string. Dropping
 * it collapsed every such URL to the same cache key regardless of which
 * video it pointed to, so a second, completely different video would get
 * served the first one's cached transcript. Confirmed live: after
 * requesting `watch?v=jNQXAC9IVRw`, requesting `watch?v=O-KDKBCPrwA`
 * returned the first video's cached transcript as if it were a real hit.
 */
const ID_QUERY_PARAM_BY_HOST: Record<string, string> = {
  "youtube.com": "v",
  "www.youtube.com": "v",
  "m.youtube.com": "v",
  "facebook.com": "v",
  "www.facebook.com": "v",
  "m.facebook.com": "v",
};

export function normalizeVideoUrl(rawUrl: string, platform: TranscriptPlatform): string {
  const url = new URL(rawUrl.trim());
  const hostname = url.hostname.toLowerCase();
  const idParam = ID_QUERY_PARAM_BY_HOST[hostname];
  const idValue = idParam ? url.searchParams.get(idParam) : null;
  // Only the hostname is safe to lowercase — YouTube/Facebook/TikTok/
  // Instagram video IDs and shortcodes are case-sensitive (confirmed:
  // Instagram shortcodes mix upper/lowercase letters meaningfully), so
  // lowercasing the path or query here would collide two different videos
  // into the same cache key exactly like the query-stripping bug above.
  const search = idValue ? `?${idParam}=${idValue}` : "";
  return `${platform}:${hostname}${url.pathname}${search}`.replace(/\/+$/, "");
}
