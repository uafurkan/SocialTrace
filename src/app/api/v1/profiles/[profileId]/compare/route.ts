import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { compareSnapshots } from "@/lib/diff/compare";

const KINDS = ["follower", "following"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Read-only: comparisons are computed on demand from the memberships
 * table's history columns (see src/lib/diff/compare.ts), not stored.
 * `profileId` in the path is unused for lookup, kept for consistency with
 * the other /profiles/[profileId]/* routes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const kind = searchParams.get("kind");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!username || !from || !to) {
    return NextResponse.json({ error: "username, from, and to query params are required" }, { status: 400 });
  }
  if (!KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "kind must be follower or following" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Comparison requires a configured database." }, { status: 501 });
  }

  const result = await compareSnapshots(username, kind as Kind, from, to);
  if (!result) {
    return NextResponse.json({ error: "Profile or snapshot not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
