import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { isAllowedMediaHost } from "../download/utils";

/**
 * Inline (not download) proxy for avatar/thumbnail images hotlinked from
 * Instagram/Facebook CDN. Fetching these directly from the browser was
 * observed to intermittently fail (falling back to initials/blank tiles)
 * for real visitors even though a server-side fetch of the same URL
 * succeeds every time — consistent with an ISP or network-level block on
 * fbcdn.net/cdninstagram.com that doesn't affect Vercel's own egress.
 * Routing through our own domain sidesteps that: the browser only ever
 * talks to socialtrace.co, and the CDN fetch happens server-to-server.
 * Same host allowlist as the download route (SSRF guard — this is a
 * public, unauthenticated route).
 */
const PROXY_RATE_LIMIT = 300;
const PROXY_RATE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get("url");

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

  const rate = await rateLimit(`media-proxy:${clientIdentifierFor(request)}`, PROXY_RATE_LIMIT, PROXY_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many image requests. Please slow down." },
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

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
