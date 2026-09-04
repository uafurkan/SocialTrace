import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { ProfileNotFoundError } from "@/lib/providers";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { createSavedSearch, listSavedSearches } from "@/lib/tracking/saved-searches";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS } from "@/lib/tracking/visitor-cookie";

const KINDS = ["follower", "following"] as const;
type Kind = (typeof KINDS)[number];

const SAVE_RATE_LIMIT = 20;
const SAVE_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ available: false, items: [] });
  }
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const items = visitorId ? await listSavedSearches(visitorId) : [];
  return NextResponse.json({ available: true, items });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const kind = searchParams.get("kind");
  const query = searchParams.get("query");

  if (!username || !query) {
    return NextResponse.json({ error: "username and query params are required" }, { status: 400 });
  }
  if (!KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "kind must be follower or following" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Saved searches require a configured database (DATABASE_URL is not set)." },
      { status: 501 },
    );
  }

  const rate = rateLimit(`saved-search:${clientIdentifierFor(request)}`, SAVE_RATE_LIMIT, SAVE_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? randomUUID();

  try {
    await createSavedSearch(username, kind as Kind, query, visitorId);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    throw error;
  }

  const response = NextResponse.json({ saved: true });
  response.cookies.set(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_OPTIONS);
  return response;
}
