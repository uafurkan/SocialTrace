import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { listTrackedProfiles } from "@/lib/tracking/watchlist";
import { VISITOR_COOKIE } from "@/lib/tracking/visitor-cookie";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ available: false, items: [] });
  }
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const items = visitorId ? await listTrackedProfiles(visitorId) : [];
  return NextResponse.json({ available: true, items });
}
