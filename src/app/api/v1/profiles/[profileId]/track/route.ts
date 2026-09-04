import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { ProfileNotFoundError } from "@/lib/providers";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { isProfileTracked, trackProfile, untrackProfile } from "@/lib/tracking/watchlist";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS } from "@/lib/tracking/visitor-cookie";

const TRACK_RATE_LIMIT = 30;
const TRACK_RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * `profileId` in the path is unused for lookup (see the sibling
 * export/snapshots/changes routes) — the visitor id comes from a cookie,
 * not the URL, since there's no auth to identify who's asking.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Tracking requires a configured database (DATABASE_URL is not set)." },
      { status: 501 },
    );
  }

  const rate = rateLimit(`track:${clientIdentifierFor(request)}`, TRACK_RATE_LIMIT, TRACK_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? randomUUID();

  try {
    await trackProfile(username, visitorId);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    throw error;
  }

  const response = NextResponse.json({ tracked: true });
  response.cookies.set(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_OPTIONS);
  return response;
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Tracking requires a configured database (DATABASE_URL is not set)." },
      { status: 501 },
    );
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (visitorId) await untrackProfile(username, visitorId);
  return NextResponse.json({ tracked: false });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ tracked: false });
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const tracked = visitorId ? await isProfileTracked(username, visitorId) : false;
  return NextResponse.json({ tracked });
}
