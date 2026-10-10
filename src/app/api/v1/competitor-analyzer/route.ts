import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveSide, STATUS_BY_REASON } from "@/lib/competitor/resolve-side";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Same reasoning as engagement-calculator/route.ts.
export const maxDuration = 90;

const COMPETITOR_RATE_LIMIT = 10;
const COMPETITOR_RATE_WINDOW_MS = 10 * 60 * 1000;

const PROFILE_SCHEMA = z.object({
  platform: z.enum(["instagram", "tiktok", "facebook"]),
  username: z.string().trim().min(1).max(60),
});

const REQUEST_SCHEMA = z.object({ a: PROFILE_SCHEMA, b: PROFILE_SCHEMA });

/** A side that runs past its deadline is reported as its own error; the other side is still returned. */
const STATUS_BY_SIDE_REASON: Record<string, number> = { ...STATUS_BY_REASON, timeout: 504 };

export async function POST(request: NextRequest) {
  const rate = await rateLimit(`competitor-analyzer:${clientIdentifierFor(request)}`, COMPETITOR_RATE_LIMIT, COMPETITOR_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "two profiles (a, b) are required" }, { status: 400 });
  }

  const { a, b } = parsed.data;
  if (a.platform === b.platform && a.username.trim().toLowerCase() === b.username.trim().toLowerCase()) {
    return NextResponse.json({ error: "Pick two different profiles to compare." }, { status: 400 });
  }

  const [sideA, sideB] = await Promise.all([resolveSide(a.platform, a.username), resolveSide(b.platform, b.username)]);

  if (sideA.error && sideB.error) {
    // Both sides failed — surface the first side's reason/status as the overall response,
    // matching how a single-profile failure is reported by /api/v1/engagement-calculator.
    const status = STATUS_BY_SIDE_REASON[sideA.error.reason] ?? 502;
    return NextResponse.json({ a: sideA, b: sideB }, { status });
  }

  return NextResponse.json({ a: sideA, b: sideB });
}
