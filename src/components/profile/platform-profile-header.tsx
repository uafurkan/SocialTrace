import { BadgeCheck } from "lucide-react";

import type { Profile } from "@/lib/domain/types";
import { ProfileStatRow } from "@/components/profile/profile-stat-row";
import { ZoomableAvatar } from "@/components/profile/zoomable-avatar";

/**
 * Lean profile header shared by TikTok/Facebook profile pages — same
 * avatar/verified-badge/counts look as Instagram's ProfileHeader, minus
 * Track/Compare/Export (those are tied to watchlist/snapshot DB tables
 * this slice doesn't wire up for the new platforms — see docs/DECISIONS.md).
 */
export function PlatformProfileHeader({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <ZoomableAvatar username={profile.username} displayName={profile.displayName} avatarUrl={profile.avatarUrl} />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-primary">@{profile.username}</h1>
          {profile.isVerified ? <BadgeCheck className="size-5 text-info" aria-label="Verified" /> : null}
        </div>
        <p className="text-sm font-medium text-secondary">{profile.displayName}</p>
        {profile.bio ? <p className="mt-2 max-w-md text-sm text-secondary">{profile.bio}</p> : null}

        <ProfileStatRow
          stats={[
            { label: "Followers", value: profile.followerCount },
            { label: "Following", value: profile.followingCount },
            ...(profile.postCount > 0 ? [{ label: "Posts", value: profile.postCount }] : []),
          ]}
        />
      </div>
    </div>
  );
}
