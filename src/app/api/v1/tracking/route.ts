import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { resolveIdentity } from "@/lib/auth/identity";
import { listTrackedProfiles } from "@/lib/tracking/watchlist";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ available: false, items: [] });
  }
  const identity = await resolveIdentity(request);
  const items = await listTrackedProfiles(identity.scopeId);
  return NextResponse.json({ available: true, items });
}
