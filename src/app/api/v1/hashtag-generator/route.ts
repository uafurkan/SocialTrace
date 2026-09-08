import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateHashtags } from "@/lib/hashtags/generate";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// No external call is made here at all, so this limit exists purely to
// bound abuse of the route itself, not cost — the most generous limit
// in the tool-expansion plan.
const HASHTAG_RATE_LIMIT = 30;
const HASHTAG_RATE_WINDOW_MS = 10 * 60 * 1000;

const REQUEST_SCHEMA = z.object({
  text: z.string().trim().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const rate = await rateLimit(`hashtag-generator:${clientIdentifierFor(request)}`, HASHTAG_RATE_LIMIT, HASHTAG_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "text is required (1-2000 characters)" }, { status: 400 });
  }

  const result = generateHashtags(parsed.data.text);
  return NextResponse.json(result);
}
