import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import {
  MAX_MEDIA_BYTES,
  PayloadTooLargeError,
  classifyVideoUrl,
  declaredLengthExceeds,
  isRedirectStatus,
  readCappedBody,
  redirectLimitReached,
  resolveRedirectLocation,
  videoProxyMode,
  type UrlVerdict,
} from "@/lib/media/guard";
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
 * hop) is checked by `@/lib/media/guard`: https only, no private or loopback
 * address (no localhost/internal-IP SSRF pivot), and a host allowlist. The
 * allowlist runs in `VIDEO_PROXY_MODE`: `log` (default) serves a miss and
 * logs it so real hosts can be learned, `enforce` refuses it with 403.
 * Private addresses are refused in both modes.
 */

/**
 * Host-level verdict for one URL the route is about to fetch (the initial
 * request or a redirect target). api.apify.com is governed by its own rule:
 * only key-value-store record URLs pass, because that is the one shape that
 * receives the Apify token (see apify-media.ts).
 */
type HopVerdict = UrlVerdict | { kind: "blocked"; reason: "apify-non-record" };

function verdictFor(url: URL): HopVerdict {
  if (url.hostname.replace(/\.$/, "") === "api.apify.com") {
    return isAllowedApifyMediaUrl(url.href)
      ? { kind: "allowed" }
      : { kind: "blocked", reason: "apify-non-record" };
  }
  return classifyVideoUrl(url);
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
  const initial = verdictFor(target);
  if (initial.kind === "blocked") {
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }
  if (initial.kind === "would-block") {
    if (mode === "enforce") return NextResponse.json({ error: "url not allowed" }, { status: 403 });
    warnWouldBlock(target, initial.reason);
  }

  const range = request.headers.get("range");
  // One deadline for the whole request, including every redirect hop.
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let current = target;
  let redirectsFollowed = 0;
  let upstream: Response;
  for (;;) {
    try {
      upstream = await fetch(current, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...(range ? { Range: range } : {}),
          // Apify-hosted key-value-store files (TikTok's fallback actor,
          // YouTube's fast actor) need this to fetch at all — attached here,
          // server-side, so the token itself never has to travel through the
          // `url` query param this route was called with (see apify-media.ts).
          // Computed per hop, so a redirect to another host never gets it.
          ...apifyMediaHeaders(current.href),
        },
        // Redirects are followed by hand so each hop passes the same checks.
        redirect: "manual",
        signal,
      });
    } catch {
      return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    }

    if (!isRedirectStatus(upstream.status)) break;
    const next = resolveRedirectLocation(upstream.headers.get("location"), current);
    if (!next) break; // Returned as-is below: a 3xx is not ok, so the response is 502.
    await upstream.body?.cancel().catch(() => undefined);

    if (redirectLimitReached(redirectsFollowed)) {
      return NextResponse.json({ error: "too many redirects" }, { status: 502 });
    }
    redirectsFollowed += 1;

    const hop = verdictFor(next);
    if (hop.kind === "blocked") return NextResponse.json({ error: "url not allowed" }, { status: 403 });
    if (hop.kind === "would-block") {
      if (mode === "enforce") return NextResponse.json({ error: "url not allowed" }, { status: 403 });
      warnWouldBlock(next, hop.reason);
    }
    current = next;
  }

  if (!upstream.ok && upstream.status !== 206) {
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
