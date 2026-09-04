import { NextRequest, NextResponse } from "next/server";

import { provider } from "@/lib/providers";

/** Username search-as-you-type suggestions for the homepage search box. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const limit = Math.min(Number(searchParams.get("limit")) || 8, 10);
  const items = await provider.searchUsers(query, limit);
  return NextResponse.json({ items });
}
