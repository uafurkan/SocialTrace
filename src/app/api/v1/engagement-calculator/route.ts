import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { calculateEngagement, EngagementError, type EngagementErrorReason } from "@/lib/engagement/calculate";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// The response no longer blocks on Bright Data (see
// providers/brightdata/profile.ts), but its background warm via `after()`
// shares this function's execution budget, so this stays raised past 60.
export const maxDuration = 90;

const ENGAGEMENT_RATE_LIMIT = 20;
const ENGAGEMENT_RATE_WINDOW_MS = 10 * 60 * 1000;

const REQUEST_SCHEMA = z.object({
  platform: z.enum(["instagram", "tiktok", "facebook"]),
  username: z.string().trim().min(1).max(60),
});

const STATUS_BY_REASON: Record<EngagementErrorReason, number> = {
  profile_not_found: 404,
  private_account: 403,
  no_posts: 422,
  // 503, not 502: the profile is fine, our data source is temporarily out.
  source_unavailable: 503,
};

export async function POST(request: NextRequest) {
  const rate = await rateLimit(`engagement:${clientIdentifierFor(request)}`, ENGAGEMENT_RATE_LIMIT, ENGAGEMENT_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "platform and username are required" }, { status: 400 });
  }

  try {
    const result = await calculateEngagement(parsed.data.platform, parsed.data.username);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof EngagementError) {
      return NextResponse.json({ error: error.reason, message: error.message }, { status: STATUS_BY_REASON[error.reason] });
    }
    console.error("[engagement-calculator] failed:", error);
    return NextResponse.json({ error: "engagement_failed", message: "Could not calculate engagement for this profile." }, { status: 502 });
  }
}
