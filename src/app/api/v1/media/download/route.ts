import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import {
  MAX_MEDIA_BYTES,
  createCappedStream,
  declaredLengthExceeds,
  isRedirectStatus,
  redirectLimitReached,
  resolveRedirectLocation,
} from "@/lib/media/guard";
import { extensionFor, isAllowedMediaHost, sanitizeFilename } from "./utils";

/**
 * Proxies a single media file (post/reel/story image or video) so the
 * browser gets a real download instead of a hotlinked <a href> to
 * Instagram's own CDN (which ignores `download` cross-origin and, for the
 * mock provider, points at a placeholder image service). Restricted to a
 * host allowlist rather than accepting any URL — this is a public route
 * with no auth, so an open proxy to arbitrary URLs would be an SSRF hole.
 *
 * Redirects are followed by hand (at most MAX_REDIRECTS), and every hop must
 * pass the same host allowlist as the first URL. The body is capped at
 * MAX_MEDIA_BYTES, both by Content-Length and by counting bytes as they
 * stream, and the stream is abandoned after BODY_TIMEOUT_MS.
 */
const DOWNLOAD_RATE_LIMIT = 30;
const DOWNLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const BODY_TIMEOUT_MS = 60_000;

function isAllowedMediaUrl(url: URL): boolean {
  return url.protocol === "https:" && isAllowedMediaHost(url.hostname);
}

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

  if (!isAllowedMediaUrl(parsed)) {
    return NextResponse.json({ error: "url host is not allowed" }, { status: 400 });
  }

  const rate = await rateLimit(`media-download:${clientIdentifierFor(request)}`, DOWNLOAD_RATE_LIMIT, DOWNLOAD_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many download requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // The header timeout covers the whole redirect chain. It is cleared once
  // the final response's headers have arrived.
  const controller = new AbortController();
  const headerTimeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let current = parsed;
  let redirectsFollowed = 0;
  let upstream: Response;
  try {
    for (;;) {
      upstream = await fetch(current.toString(), { redirect: "manual", signal: controller.signal });
      if (!isRedirectStatus(upstream.status)) break;
      const next = resolveRedirectLocation(upstream.headers.get("location"), current);
      if (!next) break; // Returned as-is below: a 3xx is not ok, so the response is 502.
      await upstream.body?.cancel().catch(() => undefined);

      if (redirectLimitReached(redirectsFollowed)) {
        return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
      }
      redirectsFollowed += 1;
      if (!isAllowedMediaUrl(next)) {
        return NextResponse.json({ error: "url host is not allowed" }, { status: 403 });
      }
      current = next;
    }
  } catch {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  } finally {
    clearTimeout(headerTimeout);
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Media not available" }, { status: 502 });
  }

  if (declaredLengthExceeds(upstream.headers.get("content-length"), MAX_MEDIA_BYTES)) {
    await upstream.body.cancel().catch(() => undefined);
    return NextResponse.json({ error: "Media too large" }, { status: 413 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const filename = `${sanitizeFilename(filenameParam)}.${extensionFor(contentType)}`;

  // The body deadline starts when headers arrive. Aborting the controller
  // errors the pending body read, which ends the stream.
  const bodyTimeout = setTimeout(() => controller.abort(), BODY_TIMEOUT_MS);
  const body = createCappedStream(upstream.body, MAX_MEDIA_BYTES, () => clearTimeout(bodyTimeout));

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
