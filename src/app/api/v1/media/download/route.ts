import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { extensionFor, isAllowedMediaHost, sanitizeFilename } from "./utils";

/**
 * Proxies a single media file (post/reel/story image or video) so the
 * browser gets a real download instead of a hotlinked <a href> to
 * Instagram's own CDN (which ignores `download` cross-origin and, for the
 * mock provider, points at a placeholder image service). Restricted to a
 * host allowlist rather than accepting any URL — this is a public route
 * with no auth, so an open proxy to arbitrary URLs would be an SSRF hole.
 */
const DOWNLOAD_RATE_LIMIT = 30;
const DOWNLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get("url");
  const filenameParam = searchParams.get("filename") ?? "socialtrace-media";

  if (!mediaUrl) {
    return NextResponse.json({ error: "url query param is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return NextResponse.json({ error: "url is not a valid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedMediaHost(parsed.hostname)) {
    return NextResponse.json({ error: "url host is not allowed" }, { status: 400 });
  }

  const rate = await rateLimit(`media-download:${clientIdentifierFor(request)}`, DOWNLOAD_RATE_LIMIT, DOWNLOAD_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many download requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), { signal: controller.signal });
  } catch {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Media not available" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const filename = `${sanitizeFilename(filenameParam)}.${extensionFor(contentType)}`;

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
