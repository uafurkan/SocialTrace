import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { resolveIdentity } from "@/lib/auth/identity";
import { ProfileNotFoundError } from "@/lib/providers";
import { PlanLimitError } from "@/lib/billing/plans";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { isProfileTracked, trackProfile, untrackProfile } from "@/lib/tracking/watchlist";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS } from "@/lib/tracking/visitor-cookie";

const TRACK_RATE_LIMIT = 30;
const TRACK_RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * `profileId` in the path is unused for lookup (see the sibling
 * export/snapshots/changes routes) — the tracking identity comes from
 * resolveIdentity (an account session if logged in, otherwise the
 * anonymous visitor cookie), not the URL — see src/lib/auth/identity.ts.
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

  const rate = await rateLimit(`track:${clientIdentifierFor(request)}`, TRACK_RATE_LIMIT, TRACK_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const identity = await resolveIdentity(request);

  try {
    await trackProfile(username, identity.scopeId, identity.account?.plan);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const response = NextResponse.json({ tracked: true });
  if (identity.visitorCookieToIssue) {
    response.cookies.set(VISITOR_COOKIE, identity.visitorCookieToIssue, VISITOR_COOKIE_OPTIONS);
  }
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

  const identity = await resolveIdentity(request);
  await untrackProfile(username, identity.scopeId);
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

  const identity = await resolveIdentity(request);
  const tracked = await isProfileTracked(username, identity.scopeId);
  return NextResponse.json({ tracked });
}
