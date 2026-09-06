import type { Metadata } from "next";

import { isDbConfigured } from "@/lib/db";
import { resolveIdentityReadOnly } from "@/lib/auth/identity";
import { listTrackedProfiles } from "@/lib/tracking/watchlist";
import { listSavedSearches } from "@/lib/tracking/saved-searches";
import { NotAvailable } from "@/components/profile/not-available";
import { TrackedProfileList } from "@/components/tracking/tracked-profile-list";
import { SavedSearchList } from "@/components/tracking/saved-search-list";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Tracked profiles",
  description: "Profiles you're tracking on SocialTrace, with follower changes since their last snapshot.",
  path: "/tracking",
  noIndex: true,
});

export default async function TrackingPage() {
  const trackingAvailable = isDbConfigured();
  const [profiles, savedSearches] = trackingAvailable
    ? await (async () => {
        const identity = await resolveIdentityReadOnly();
        return Promise.all([listTrackedProfiles(identity.scopeId), listSavedSearches(identity.scopeId)]);
      })()
    : [[], []];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-primary">Tracked profiles</h1>
      <p className="mt-1 text-sm text-secondary">
        Profiles you&apos;ve clicked &quot;Track profile&quot; on. These recapture automatically on a
        schedule, or you can capture a new snapshot yourself from a profile&apos;s History tab any time.
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
