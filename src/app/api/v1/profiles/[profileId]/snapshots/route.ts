import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { ProfileNotFoundError } from "@/lib/providers";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { captureSnapshot, listSnapshots } from "@/lib/snapshot/capture";

const CAPTURE_RATE_LIMIT = 10;
const CAPTURE_RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Spec §19's snapshot lifecycle assumes a job queue; this build has none,
 * so POST captures synchronously inside the request (see
 * src/lib/snapshot/capture.ts, docs/SNAPSHOTS.md). `profileId` in the path
 * is unused for lookup (providers only expose getProfile-by-username) but
 * kept for consistency with the other /profiles/[profileId]/* routes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ available: false, items: [] });
  }
  const items = await listSnapshots(username);
  return NextResponse.json({ available: true, items });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Snapshot capture requires a configured database (DATABASE_URL is not set)." },
      { status: 501 },
    );
  }

  const rate = await rateLimit(`capture:${clientIdentifierFor(request)}`, CAPTURE_RATE_LIMIT, CAPTURE_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many snapshot captures. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const snapshot = await captureSnapshot(username);
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    throw error;
  }
}
