/**
 * Some Apify actors (TikTok's paid fallback, YouTube's fast primary actor)
 * write their output file into Apify's own key-value store rather than a
 * public CDN — confirmed live: fetching that file's URL returns 403
 * without `Authorization: Bearer <APIFY_API_TOKEN>`, 200 with it. Every
 * other actor/free-path URL in this pipeline (tikwm, Instagram/Facebook's
 * embed pages, the slower YouTube actor) needs no such header at all.
 *
 * Centralizing "is this Apify-hosted, and if so attach the token" here —
 * instead of each downloader function deciding it locally — is what fixed
 * a real bug: `downloader.ts` used to embed the token directly in the
 * *audio* URL (`?token=...`) but then null out the *video* preview URL
 * entirely whenever a token was needed, specifically to avoid leaking that
 * token to the browser (a videoUrl reaches the client, embedded in the
 * page's own network requests). That traded a real security bug for a
 * visible feature gap — the video preview silently never showed up for
 * YouTube (which almost always uses this actor) and intermittently for
 * TikTok's fallback path. Both call sites that actually fetch this media
 * — `speech-to-text`'s audio fetch (server-side only) and `/video-proxy`
 * (the only thing the browser ever talks to, and itself server-side) — now
 * attach the token as a header transparently via this helper instead, so
 * the token never has to appear inside a URL at all, and a video URL is
 * safe to hand to the browser exactly as-is.
 *
 * The token goes only to a key-value-store record URL on api.apify.com (see
 * `isAllowedApifyMediaUrl`). The proxy is public, so any other Apify URL,
 * even one on a related apify.com host, must be fetched without it.
 */
const APIFY_MEDIA_HOST_SUFFIX = ".apify.com";
const APIFY_API_HOST = "api.apify.com";
// Store IDs and keys are matched without percent-encoding: an encoded "/"
// must not let one segment stand in for several path segments.
const KEY_VALUE_RECORD_PATH = /^\/v2\/key-value-stores\/[A-Za-z0-9_-]+\/records\/[^/%]+$/;

/**
 * Host-level check only: true for apify.com and any subdomain of it. This does
 * not decide token attachment; use `isAllowedApifyMediaUrl` for that.
 */
export function isApifyMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "apify.com" || host.endsWith(APIFY_MEDIA_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * True only for an https key-value-store record URL on api.apify.com, the one
 * shape that receives the token and the only Apify URL the video proxy will
 * fetch. Host and path are matched exactly, so `evil-apify.com`,
 * `apify.com.evil.example`, a trailing-dot host, or `/v2/users/me` all fail.
 */
export function isAllowedApifyMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === APIFY_API_HOST &&
      KEY_VALUE_RECORD_PATH.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/** Extra headers needed to fetch `url` — empty unless it's an allowed Apify record URL and the token is set, so every caller can spread this in unconditionally rather than branching. */
export function apifyMediaHeaders(url: string): Record<string, string> {
  if (!isAllowedApifyMediaUrl(url)) return {};
  const token = process.env.APIFY_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
