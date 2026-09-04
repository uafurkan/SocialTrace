import type { Metadata } from "next";
import { cookies } from "next/headers";

import { isDbConfigured } from "@/lib/db";
import { listTrackedProfiles } from "@/lib/tracking/watchlist";
import { listSavedSearches } from "@/lib/tracking/saved-searches";
import { VISITOR_COOKIE } from "@/lib/tracking/visitor-cookie";
import { NotAvailable } from "@/components/profile/not-available";
import { TrackedProfileList } from "@/components/tracking/tracked-profile-list";
import { SavedSearchList } from "@/components/tracking/saved-search-list";

export const metadata: Metadata = {
  title: "Tracked profiles",
  description: "Profiles you're tracking on SocialTrace, with follower changes since their last snapshot.",
};

export default async function TrackingPage() {
  const trackingAvailable = isDbConfigured();
  const visitorId = trackingAvailable ? cookies().get(VISITOR_COOKIE)?.value : undefined;
  const [profiles, savedSearches] = visitorId
    ? await Promise.all([listTrackedProfiles(visitorId), listSavedSearches(visitorId)])
    : [[], []];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-primary">Tracked profiles</h1>
      <p className="mt-1 text-sm text-secondary">
        Profiles you&apos;ve clicked &quot;Track profile&quot; on. Capture a new snapshot from a profile&apos;s
        History tab to update its numbers here — tracking doesn&apos;t recapture automatically yet.
      </p>

      <div className="mt-6">
        {!trackingAvailable ? (
          <NotAvailable detail="Tracking requires a configured database, which this deployment does not have (DATABASE_URL is unset)." />
        ) : (
          <TrackedProfileList profiles={profiles} />
        )}
      </div>

      {trackingAvailable ? (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-primary">Saved searches</h2>
          <p className="mt-1 text-sm text-secondary">
            Searches you&apos;ve saved from a profile&apos;s Followers/Following tab. Shows new/removed matching
            accounts between that profile&apos;s two most recent snapshots.
          </p>
          <div className="mt-4">
            <SavedSearchList searches={savedSearches} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
