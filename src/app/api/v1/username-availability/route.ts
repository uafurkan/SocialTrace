import { NextRequest, NextResponse } from "next/server";

import { checkAllPlatforms, isValidHandle, type AvailabilityPlatform } from "@/lib/username-availability/check";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const AVAILABILITY_RATE_LIMIT = 15;
const AVAILABILITY_RATE_WINDOW_MS = 10 * 60 * 1000;

const PLATFORMS: AvailabilityPlatform[] = ["instagram", "tiktok", "facebook", "youtube"];

export async function GET(request: NextRequest) {
  const rate = await rateLimit(`username-avail:${clientIdentifierFor(request)}`, AVAILABILITY_RATE_LIMIT, AVAILABILITY_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const handle = request.nextUrl.searchParams.get("handle")?.trim() ?? "";
  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  // Reject anything that couldn't possibly be valid on ANY of the four
  // platforms before spending an outbound request — cheap, zero-cost.
  const validOnAtLeastOnePlatform = PLATFORMS.some((platform) => isValidHandle(platform, handle));
  if (!validOnAtLeastOnePlatform) {
    return NextResponse.json({ error: "handle contains characters not valid on any supported platform" }, { status: 400 });
  }

  const results = await checkAllPlatforms(handle);
  return NextResponse.json({ results });
}
