import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { resolveIdentity } from "@/lib/auth/identity";
import { deleteSavedSearch } from "@/lib/tracking/saved-searches";

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Saved searches require a configured database." }, { status: 501 });
  }
  const identity = await resolveIdentity(request);
  await deleteSavedSearch(params.id, identity.scopeId);
  return NextResponse.json({ deleted: true });
}
