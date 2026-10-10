import { NextRequest, NextResponse } from "next/server";

import { getProvider } from "@/lib/providers";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// Interim per-IP limit, shared by all member-list routes under one key. Every
// page and search request counts. The plan (WS-R) refines this so that only
// new, uncached lookups count, and cursor paging does not spend the budget.
const MEMBERS_RATE_LIMIT = 20;
const MEMBERS_RATE_WINDOW_MS = 10 * 60 * 1000;

function isValidProfileId(profileId: string): boolean {
  return profileId.trim() !== "" && profileId.length <= 100 && !profileId.includes("/");
}

export async function GET(request: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const rate = await rateLimit(`members:${clientIdentifierFor(request)}`, MEMBERS_RATE_LIMIT, MEMBERS_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const params = await props.params;
  if (!isValidProfileId(params.profileId)) {
    return NextResponse.json({ error: "Invalid profile id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);

  try {
    const page = await getProvider("tiktok").getFollowers(params.profileId, cursor, limit, query);
    return NextResponse.json(page);
  } catch (error) {
    console.error("TikTok followers lookup failed:", error);
    return NextResponse.json({ error: "Couldn't load followers right now. Try again shortly." }, { status: 502 });
  }
}
