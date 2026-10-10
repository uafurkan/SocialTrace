import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { MAX_MEDIA_BYTES, declaredLengthExceeds } from "@/lib/media/guard";
import { MEDIA_USER_AGENT, safeFetchMedia } from "@/lib/media/safe-fetch";
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
 * pass the same host allowlist as the first URL. `safeFetchMedia` also resolves
 * each host and refuses it when any address is private or reserved, and it
 * connects to the address that was checked, which closes the DNS rebinding
 * window. The body is capped at MAX_MEDIA_BYTES, both by Content-Length and by
 * counting bytes as they stream, and the stream is abandoned after BODY_TIMEOUT_MS.
 */
const DOWNLOAD_RATE_LIMIT = 30;
const DOWNLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const BODY_TIMEOUT_MS = 60_000;

function isAllowedMediaUrl(url: URL): boolean {
  return url.protocol === "https:" && isAllowedMediaHost(url.hostname);
}

/**
 * Refusal for a refused hop. A name that does not resolve is a 400 in either
 * position. Any other refusal is a 400 for the first URL and a 403 for a
 * redirect target, the status the allowlist miss uses in the same position.
 */
function refusalResponse(reason: string, redirect: boolean): NextResponse {
  if (reason === "unresolvable") {
    return NextResponse.json({ error: "url host could not be resolved" }, { status: 400 });
  }
  return NextResponse.json({ error: "url host is not allowed" }, { status: redirect ? 403 : 400 });
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

  // The header timeout covers the whole redirect chain. It is cleared once the
  // final response's headers have arrived, and the body timeout starts then.
  const result = await safeFetchMedia(parsed, {
    checkUrl: (url) => (isAllowedMediaUrl(url) ? { ok: true } : { ok: false, reason: "host-not-allowlisted" }),
    headers: () => ({ "User-Agent": MEDIA_USER_AGENT }),
    headersTimeoutMs: FETCH_TIMEOUT_MS,
    bodyTimeoutMs: BODY_TIMEOUT_MS,
  });
  if (result.kind === "refused") return refusalResponse(result.reason, result.redirect);
  if (result.kind === "too-many-redirects") return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
  if (result.kind === "failed") return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  const upstream = result.response;

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: "Media not available" }, { status: 502 });
  }

  if (declaredLengthExceeds(upstream.headers.get("content-length"), MAX_MEDIA_BYTES)) {
    await upstream.body.cancel().catch(() => undefined);
    return NextResponse.json({ error: "Media too large" }, { status: 413 });
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
