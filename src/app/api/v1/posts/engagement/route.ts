import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { provider } from "@/lib/providers";

/**
 * Likers + comments are per-post, not per-profile, so this is a small
 * dedicated route rather than a provider call baked into the profile page
 * — the post grid (a client component) fetches this on demand when the
 * viewer opens a specific post's detail view, instead of every post in a
 * grid eagerly fetching its own engagement data (which would multiply the
 * Apify bill by however many posts are on screen).
 */
const ENGAGEMENT_RATE_LIMIT = 30;
const ENGAGEMENT_RATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_HOSTS = new Set(["www.instagram.com", "instagram.com"]);

function isAllowedPermalink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!provider.capabilities.postEngagement) {
    return NextResponse.json({ error: "Post engagement lookup is not enabled for the current data provider." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const permalink = searchParams.get("permalink");
  if (!permalink || !isAllowedPermalink(permalink)) {
    return NextResponse.json({ error: "A valid instagram.com post permalink is required." }, { status: 400 });
  }

  const rate = await rateLimit(`post-engagement:${clientIdentifierFor(request)}`, ENGAGEMENT_RATE_LIMIT, ENGAGEMENT_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const [likers, comments] = await Promise.all([provider.getLikers(permalink), provider.getComments(permalink)]);
    return NextResponse.json({ likers, comments });
  } catch (error) {
    console.error("Post engagement lookup failed:", error);
    return NextResponse.json({ error: "Couldn't load engagement data right now. Try again shortly." }, { status: 502 });
  }
}
