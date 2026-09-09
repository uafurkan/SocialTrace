import { NextResponse, type NextRequest } from "next/server";

import { resolveIdentity } from "@/lib/auth/identity";
import { isAdminEmail } from "@/lib/auth/admin";
import { probeSources } from "@/lib/diagnostics/sources";

/**
 * Admin-only probe answering "does the free Instagram source reach Instagram
 * from this deployment's IP" without needing Vercel log access — see
 * docs/DECISIONS.md's Phase 17 entry for why this question can't be answered
 * from the sandbox this app is normally built in.
 *
 * Returns 404 (not 401/403) for anyone else, same as a route that doesn't
 * exist, so its existence isn't disclosed to a non-admin visitor.
 */
export async function GET(request: NextRequest) {
  const identity = await resolveIdentity(request);
  if (!identity.account || !isAdminEmail(identity.account.email)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const diagnostics = await probeSources();
  return NextResponse.json(diagnostics);
}
