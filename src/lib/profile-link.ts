import type { Platform } from "@/lib/domain/types";

const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/i;

const HOST_PATTERNS: Record<Platform, RegExp> = {
  instagram: /^(?:www\.)?instagram\.com$/i,
  tiktok: /^(?:www\.)?tiktok\.com$/i,
  facebook: /^(?:www\.|m\.)?facebook\.com$/i,
};

/**
 * Non-profile URL segments per platform — if the first path part after
 * the host is one of these, the input isn't a profile link (spec §1.3: we
 * only resolve real, addressable profiles, never guess from ambiguous
 * input).
 */
const RESERVED_PATH_SEGMENTS: Record<Platform, Set<string>> = {
  instagram: new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"]),
  tiktok: new Set(["video", "tag", "music", "discover", "foryou", "following", "live"]),
  facebook: new Set(["photo", "photo.php", "video.php", "watch", "groups", "events", "marketplace", "reel"]),
};

/**
 * No search-as-you-type here on purpose — a live suggestions box means a
 * network call (and, once a real provider is enabled, a billed API call)
 * on every keystroke. Instead this requires the full username or a
 * profile link, then does exactly one lookup on submit — the same single
 * request that loading the profile page would make anyway. See
 * docs/SEARCH.md. `platform` defaults to "instagram" so every pre-existing
 * call site keeps working unchanged.
 */
export function extractUsername(input: string, platform: Platform = "instagram"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, "");
  if (USERNAME_PATTERN.test(withoutAt)) return withoutAt;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!HOST_PATTERNS[platform].test(url.hostname)) return null;

    let [firstSegment] = url.pathname.split("/").filter(Boolean);
    // TikTok profile links use /@username, not /username.
    if (platform === "tiktok" && firstSegment?.startsWith("@")) firstSegment = firstSegment.slice(1);
    if (!firstSegment || RESERVED_PATH_SEGMENTS[platform].has(firstSegment.toLowerCase())) return null;
    return USERNAME_PATTERN.test(firstSegment) ? firstSegment : null;
  } catch {
    return null;
  }
}
