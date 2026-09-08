import { NextRequest, NextResponse } from "next/server";
import { apifyMediaHeaders } from "@/lib/transcription/apify-media";

export const runtime = "nodejs";
export const maxDuration = 60;

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
 * query param is still attacker-reachable directly, so it's restricted to
 * `https:` and a real hostname (no localhost/internal-IP SSRF pivot) rather
 * than trusted blindly.
 */
function isSafeVideoUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  return true;
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
  if (!isSafeVideoUrl(target)) {
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }

  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(range ? { Range: range } : {}),
        // Apify-hosted key-value-store files (TikTok's fallback actor,
        // YouTube's fast actor) need this to fetch at all — attached here,
        // server-side, so the token itself never has to travel through the
        // `url` query param this route was called with (see apify-media.ts).
        ...apifyMediaHeaders(raw),
      },
      signal: AbortSignal.timeout(50_000),
    });
  } catch {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: `upstream returned ${upstream.status}` }, { status: 502 });
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
  let body: ArrayBuffer;
  try {
    body = await upstream.arrayBuffer();
  } catch {
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
