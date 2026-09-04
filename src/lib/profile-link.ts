const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/i;

const INSTAGRAM_HOST_PATTERN = /^(?:www\.)?instagram\.com$/i;

/**
 * Non-profile Instagram URL segments — if the first path part after the
 * host is one of these, the input isn't a profile link (spec §1.3: we
 * only resolve real, addressable profiles, never guess from ambiguous
 * input).
 */
const RESERVED_PATH_SEGMENTS = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"]);

/**
 * No search-as-you-type here on purpose — a live suggestions box means a
 * network call (and, once a real provider is enabled, a billed API call)
 * on every keystroke. Instead this requires the full username or a
 * profile link, then does exactly one lookup on submit — the same single
 * request that loading the profile page would make anyway. See
 * docs/SEARCH.md.
 */
export function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, "");
  if (USERNAME_PATTERN.test(withoutAt)) return withoutAt;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) return null;

    const [firstSegment] = url.pathname.split("/").filter(Boolean);
    if (!firstSegment || RESERVED_PATH_SEGMENTS.has(firstSegment.toLowerCase())) return null;
    return USERNAME_PATTERN.test(firstSegment) ? firstSegment : null;
  } catch {
    return null;
  }
}
