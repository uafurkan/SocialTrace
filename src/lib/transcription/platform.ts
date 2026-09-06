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

/** Canonical cache key for a link — strips tracking params/fragment so `?si=...`-style share links don't fragment the cache. */
export function normalizeVideoUrl(rawUrl: string, platform: TranscriptPlatform): string {
  const url = new URL(rawUrl.trim());
  url.hash = "";
  url.search = "";
  return `${platform}:${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/, "");
}
