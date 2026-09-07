import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import type { Profile } from "@/lib/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CoverageBadge } from "@/components/profile/coverage-badge";
import { ExportMenu } from "@/components/profile/export-menu";
import { ProfileStatRow } from "@/components/profile/profile-stat-row";
import { TrackButton } from "@/components/profile/track-button";
import { copy } from "@/lib/copy";

interface ProfileHeaderProps {
  profile: Profile;
  initialTracked: boolean;
  dbAvailable: boolean;
}

export function ProfileHeader({ profile, initialTracked, dbAvailable }: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar
          username={profile.username}
          displayName={profile.displayName}
          avatarUrl={profile.avatarUrl}
          size="xl"
          className="border border-border"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-primary">@{profile.username}</h1>
            {profile.isVerified ? (
              <BadgeCheck className="size-5 text-info" aria-label="Verified" />
            ) : null}
          </div>
          <p className="text-sm font-medium text-secondary">{profile.displayName}</p>
          <p className="mt-2 max-w-md text-sm text-secondary">{profile.bio}</p>

          <ProfileStatRow
            stats={[
              { label: "Followers", value: profile.followerCount },
              { label: "Following", value: profile.followingCount },
              { label: "Posts", value: profile.postCount },
            ]}
          />

          <div className="mt-4 rounded-card border border-border bg-surface-subtle px-3 py-2">
            <CoverageBadge coverage={profile.followerCoverage} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:w-44 sm:shrink-0">
        <TrackButton
          profileId={profile.id}
          username={profile.username}
          initialTracked={initialTracked}
          available={dbAvailable}
        />
        {dbAvailable ? (
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/profile/${profile.username}/compare`}>{copy.profile.compareCta}</Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled title={copy.profile.comingSoon} className="w-full">
            {copy.profile.compareCta}
          </Button>
        )}
        <ExportMenu profileId={profile.id} username={profile.username} />
      </div>
    </div>
  );
}
