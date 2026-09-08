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
 */
const APIFY_MEDIA_HOST_SUFFIX = ".apify.com";

export function isApifyMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "apify.com" || host.endsWith(APIFY_MEDIA_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Extra headers needed to fetch `url` — empty for anything that isn't Apify-hosted, so every caller can spread this in unconditionally rather than branching. */
export function apifyMediaHeaders(url: string): Record<string, string> {
  if (!isApifyMediaUrl(url)) return {};
  const token = process.env.APIFY_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
