import { BadgeCheck, User } from "lucide-react";

import type { Profile } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoverageBadge } from "@/components/profile/coverage-badge";
import { ExportMenu } from "@/components/profile/export-menu";
import { formatCount } from "@/lib/utils";
import { copy } from "@/lib/copy";

export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-subtle text-muted">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-9" aria-hidden="true" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-primary">@{profile.username}</h1>
            {profile.isVerified ? (
              <BadgeCheck className="size-5 text-info" aria-label="Verified" />
            ) : null}
          </div>
          <p className="text-sm font-medium text-secondary">{profile.displayName}</p>
          <p className="mt-2 max-w-md text-sm text-secondary">{profile.bio}</p>

          <dl className="mt-4 flex gap-6 text-sm">
            <div>
              <dt className="text-muted">Followers</dt>
              <dd className="font-semibold text-primary">{formatCount(profile.followerCount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Following</dt>
              <dd className="font-semibold text-primary">{formatCount(profile.followingCount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Posts</dt>
              <dd className="font-semibold text-primary">{formatCount(profile.postCount)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <Badge variant={profile.followerCoverage.status === "available" ? "success" : "warning"}>
              {copy.profile.dataStatusLabel}:{" "}
              {profile.followerCoverage.status === "available" ? "Available" : "Partial"}
            </Badge>
            <div className="mt-2">
              <CoverageBadge coverage={profile.followerCoverage} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 sm:flex-col">
        <Button variant="primary">{copy.profile.trackCta}</Button>
        <Button variant="secondary" disabled title={copy.profile.comingSoon}>
          {copy.profile.compareCta}
        </Button>
        <ExportMenu profileId={profile.id} username={profile.username} />
      </div>
    </div>
  );
}
