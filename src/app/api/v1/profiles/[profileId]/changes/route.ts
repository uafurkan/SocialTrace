import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { listChanges } from "@/lib/diff/changes";

/**
 * Read-only: change_events are written as a byproduct of captureSnapshot
 * (src/lib/snapshot/capture.ts), not triggered from here — see
 * docs/DIFF.md. `profileId` in the path is unused for lookup, kept for
 * consistency with the other /profiles/[profileId]/* routes.
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
  const items = await listChanges(username);
  return NextResponse.json({ available: true, items });
}
