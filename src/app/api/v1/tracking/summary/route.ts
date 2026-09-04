import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { resolveIdentity } from "@/lib/auth/identity";
import { listTrackedProfiles } from "@/lib/tracking/watchlist";
import { listSavedSearches } from "@/lib/tracking/saved-searches";

/**
 * Backs the small activity badge next to the "Track" nav link
 * (src/components/layout/track-nav-badge.tsx) — the in-app notification
 * this build has instead of real email/push (no email-sending service is
 * configured, see docs/SCHEDULER.md; a fake "email sent" flow that sends
 * nothing would be worse than not having one). Deliberately cheap: it
 * reuses the same reads /tracking itself does rather than a separate
 * "unread" table, so the count is always "what /tracking would show you
 * right now," not a stale read receipt.
 */
export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ available: false, count: 0 });
  }
  const identity = await resolveIdentity(request);
  const [profiles, savedSearches] = await Promise.all([
    listTrackedProfiles(identity.scopeId),
    listSavedSearches(identity.scopeId),
  ]);

  const profileChanges = profiles.filter(
    (p) => p.followerDeltaSinceLastSnapshot !== null && p.followerDeltaSinceLastSnapshot !== 0,
  ).length;
  const searchMatches = savedSearches.reduce((sum, s) => sum + s.newMatches.length + s.removedMatches.length, 0);

  return NextResponse.json({ available: true, count: profileChanges + searchMatches });
}
