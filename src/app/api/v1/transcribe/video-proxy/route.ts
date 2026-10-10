import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import {
  MAX_MEDIA_BYTES,
  PayloadTooLargeError,
  classifyVideoUrl,
  declaredLengthExceeds,
  readCappedBody,
  videoProxyMode,
  type VideoProxyMode,
} from "@/lib/media/guard";
import { MEDIA_USER_AGENT, safeFetchMedia, type HopCheck } from "@/lib/media/safe-fetch";
import { apifyMediaHeaders, isAllowedApifyMediaUrl } from "@/lib/transcription/apify-media";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_PROXY_RATE_LIMIT = 60;
const VIDEO_PROXY_RATE_WINDOW_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 50_000;

/**
 * Every platform's video/CDN URL (Instagram's `.mp4`, Facebook's `hd_src`,
 * TikTok's `tikwm.com` link, the Apify-actor URLs) was being handed straight
 * to the browser as `<video src>`. That fails silently in the browser:
 * these CDNs check the request's Referer/User-Agent/Origin (hotlink
 * protection) and reject a bare cross-origin `<video>` fetch, or don't send
 * CORS headers at all — confirmed the pattern live by comparing "works via
 * server-side fetch/curl" (every downloader function above already proves
 * this — that's how the audio gets to Whisper) vs. "fails via browser
 * `<video>` element" (this bug report). The fix is the same shape as the
 * TikTok/YouTube API-token leak fix in downloader.ts: never hand the raw
 * origin URL to the browser — stream it through our own server instead,
 * where the request looks like the server-side fetches that already work.
 *
 * Only ever called with a `url` this app itself generated (from
 * `DownloadedAudio.videoUrl`) and handed back to its own client — but the
 * query param is still attacker-reachable directly, so it is not trusted
 * blindly. Every URL this route fetches (the initial one and each redirect
 * hop) goes through `safeFetchMedia` in `@/lib/media/safe-fetch`: https only,
 * no private or loopback address (no localhost/internal-IP SSRF pivot), and a
 * host allowlist. The addresses the name resolves to are checked, not only its
 * text, so a public-looking name that points at a private address is refused.
 * The connection is pinned to the address that was checked, which closes the
 * DNS rebinding window. The allowlist runs in `VIDEO_PROXY_MODE`: `log`
 * (default) serves a miss and logs it so real hosts can be learned, `enforce`
 * refuses it with 403. Private addresses are refused in both modes.
 */

/**
 * Policy for one hop, from the URL text alone, run before its addresses are
 * resolved. api.apify.com is governed by its own rule: only key-value-store
 * record URLs pass, because that is the one shape that receives the Apify
 * token (see apify-media.ts). A would-block host is logged in log mode and
 * refused in enforce mode.
 */
function hopCheckFor(url: URL, mode: VideoProxyMode): HopCheck {
  if (url.hostname.replace(/\.$/, "") === "api.apify.com") {
    return isAllowedApifyMediaUrl(url.href) ? { ok: true } : { ok: false, reason: "apify-non-record" };
  }
  const verdict = classifyVideoUrl(url);
  if (verdict.kind === "blocked") return { ok: false, reason: verdict.reason };
  if (verdict.kind === "would-block") {
    if (mode === "enforce") return { ok: false, reason: verdict.reason };
    warnWouldBlock(url, verdict.reason);
  }
  return { ok: true };
}

/**
 * Refusal for a refused hop. A host that cannot be resolved is a 400 in either
 * position, since it could not be checked. Other refusals keep the status their
 * position already uses: 400 for the first URL, 403 for a redirect target. An
 * allowlist miss refused in enforce mode is 403 for the first URL too.
 */
function refusalResponse(reason: string, redirect: boolean): NextResponse {
  if (reason === "unresolvable") {
    return NextResponse.json({ error: "url host could not be resolved" }, { status: 400 });
  }
  if (redirect) return NextResponse.json({ error: "url not allowed" }, { status: 403 });
  return NextResponse.json(
    { error: "url not allowed" },
    { status: reason === "host-not-allowlisted" ? 403 : 400 },
  );
}

function warnWouldBlock(url: URL, reason: string): void {
  // Hostname only: the path and query can carry signed or session values.
  console.warn(`[video-proxy] would-block host=${url.hostname} reason=${reason}`);
}

/** Strips everything but alphanumerics/hyphens — never interpolate raw upstream or query text into a header unescaped. */
function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url is required" }, { status: 400 });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const platformHint = sanitizeFilenamePart(request.nextUrl.searchParams.get("platform") ?? "") || "video";

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // Rate-limited before the verdict so a flood of requests cannot also flood
  // the log-mode warnings.
  const rate = await rateLimit(
    `video-proxy:${clientIdentifierFor(request)}`,
    VIDEO_PROXY_RATE_LIMIT,
    VIDEO_PROXY_RATE_WINDOW_MS,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many video requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const mode = videoProxyMode(process.env.VIDEO_PROXY_MODE);
  const range = request.headers.get("range");
  // One deadline for the whole request, including every redirect hop and the body.
  const result = await safeFetchMedia(target, {
    checkUrl: (url) => hopCheckFor(url, mode),
    headers: (url) => ({
      "User-Agent": MEDIA_USER_AGENT,
      ...(range ? { Range: range } : {}),
      // Apify-hosted key-value-store files (TikTok's fallback actor,
      // YouTube's fast actor) need this to fetch at all — attached here,
      // server-side, so the token itself never has to travel through the
      // `url` query param this route was called with (see apify-media.ts).
      // Computed per hop, so a redirect to another host never gets it.
      ...apifyMediaHeaders(url.href),
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (result.kind === "refused") return refusalResponse(result.reason, result.redirect);
  if (result.kind === "too-many-redirects") {
    return NextResponse.json({ error: "too many redirects" }, { status: 502 });
  }
  if (result.kind === "failed") return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  const upstream = result.response;

  if (!upstream.ok && upstream.status !== 206) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: `upstream returned ${upstream.status}` }, { status: 502 });
  }

  if (declaredLengthExceeds(upstream.headers.get("content-length"), MAX_MEDIA_BYTES)) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: "video too large" }, { status: 413 });
  }

  // Buffered, not streamed: piping `upstream.body` straight through as the
  // response body (the first version of this route) passed every
  // server-side check — curl and Node's own `fetch` both got byte-identical,
  // ffmpeg-verified-valid MP4s from the exact same upstream URL — yet a
  // real `<video>` element loading through that live pass-through still hit
  // `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`, yet decoded fine once the same
  // bytes were fully captured to a file first. The one thing every failing
  // case shared was live-relaying the stream while the browser consumed it
  // incrementally; fully buffering here before responding — the same thing
  // that made every other reproduction succeed — sidesteps whatever in that
  // live relay path (most likely specific to this sandbox's outbound TLS
  // interception proxy) was corrupting the in-flight stream.
  // The buffer is bounded by MAX_MEDIA_BYTES: readCappedBody counts bytes as
  // they arrive, so a response with no Content-Length cannot grow past it.
  let body: ArrayBuffer;
  try {
    body = upstream.body ? await readCappedBody(upstream.body, MAX_MEDIA_BYTES) : new ArrayBuffer(0);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "video too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "upstream body read failed" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
  headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Length", String(body.byteLength));
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set(
    "Content-Disposition",
    download ? `attachment; filename="${platformHint}-${Date.now()}.mp4"` : "inline",
  );

  return new NextResponse(body, { status: upstream.status, headers });
}
