import { NextRequest, NextResponse } from "next/server";

import { provider } from "@/lib/providers";

/**
 * Cursor-paginated, server-side-searched followers endpoint (spec §12,
 * §30, §33). The client must never fetch the whole dataset and filter in
 * the browser — this route is the search boundary.
 */
export async function GET(request: NextRequest, { params }: { params: { profileId: string } }) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);

  const page = await provider.getFollowers(params.profileId, cursor, limit, query);
  return NextResponse.json(page);
}
