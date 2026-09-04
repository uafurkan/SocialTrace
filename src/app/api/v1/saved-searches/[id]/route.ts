import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { deleteSavedSearch } from "@/lib/tracking/saved-searches";
import { VISITOR_COOKIE } from "@/lib/tracking/visitor-cookie";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Saved searches require a configured database." }, { status: 501 });
  }
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (visitorId) await deleteSavedSearch(params.id, visitorId);
  return NextResponse.json({ deleted: true });
}
