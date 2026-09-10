import { NextRequest, NextResponse } from "next/server";

import { resolveIdentity } from "@/lib/auth/identity";
import { withDataCache } from "@/lib/cache/data-cache";
import { extractLinkedInSlug } from "@/lib/linkedin/extract-slug";
import { LinkedInLookupError } from "@/lib/linkedin/types";
import { fetchLinkedInProfile } from "@/lib/providers/brightdata/linkedin";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

// Matches the ~15-54s live-observed Bright Data lookup time this route
// awaits synchronously (see providers/brightdata/linkedin.ts), with the
// same 90s headroom docs/DECISIONS.md records for other routes that can
// reach a Bright Data lookup.
export const maxDuration = 90;
export const runtime = "nodejs";

// Tighter than most tool routes: every uncached request is a real, paid
// Bright Data dataset run with no free fallback, unlike the Instagram/
// TikTok/Facebook chains that absorb most traffic before ever reaching a
// paid source.
const LINKEDIN_VIEWER_RATE_LIMIT = 10;
const LINKEDIN_VIEWER_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const rate = await rateLimit(
    `linkedin-viewer:${clientIdentifierFor(request)}`,
    LINKEDIN_VIEWER_RATE_LIMIT,
    LINKEDIN_VIEWER_RATE_WINDOW_MS,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const input = typeof body?.url === "string" ? body.url : "";
  const slug = extractLinkedInSlug(input);
  if (!slug) {
    return NextResponse.json(
      { error: "Enter a valid LinkedIn profile link (linkedin.com/in/username) or handle." },
      { status: 400 },
    );
  }

  try {
    const profile = await withDataCache(`linkedin-profile:${slug}`, () => fetchLinkedInProfile(slug));

    // Recent posts require a signed-in account — everything else about a
    // public profile (headline, about, experience, education, followers)
    // stays free. The cached profile always carries the real posts fetched
    // from Bright Data (caching happens above auth, so a signed-in visitor
    // doesn't force a re-fetch); this only strips them from the response
    // for an anonymous caller, it never re-fetches or re-bills.
    const identity = await resolveIdentity(request);
    const signedIn = identity.account !== null;
    const response = signedIn ? profile : { ...profile, posts: [] };
    return NextResponse.json({ profile: response, postsRequireSignIn: !signedIn && profile.posts.length > 0 });
  } catch (error) {
    if (error instanceof LinkedInLookupError) {
      if (error.reason === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error("[linkedin-viewer] provider unavailable:", error.message);
      return NextResponse.json(
        { error: "LinkedIn data is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    console.error("[linkedin-viewer] unexpected error:", error);
    return NextResponse.json({ error: "Something went wrong looking up this profile." }, { status: 500 });
  }
}
