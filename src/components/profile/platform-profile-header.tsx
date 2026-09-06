"use client";

import { useState } from "react";
import { BadgeCheck, X } from "lucide-react";

import type { Profile } from "@/lib/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { formatCount } from "@/lib/utils";

/**
 * Lean profile header shared by TikTok/Facebook profile pages — same
 * avatar/verified-badge/counts look as Instagram's ProfileHeader, minus
 * Track/Compare/Export (those are tied to watchlist/snapshot DB tables
 * this slice doesn't wire up for the new platforms — see docs/DECISIONS.md).
 * Adds a click-to-zoom avatar view, which Instagram's header doesn't have.
 */
export function PlatformProfileHeader({ profile }: { profile: Profile }) {
  const [zoomed, setZoomed] = useState(false);
  const proxiedAvatar = proxiedMediaUrl(profile.avatarUrl);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={() => profile.avatarUrl && setZoomed(true)}
        className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-label="View full-size profile photo"
        disabled={!profile.avatarUrl}
      >
        <Avatar
          username={profile.username}
          displayName={profile.displayName}
          avatarUrl={profile.avatarUrl}
          size="xl"
          className="border border-border"
        />
      </button>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-primary">@{profile.username}</h1>
          {profile.isVerified ? <BadgeCheck className="size-5 text-info" aria-label="Verified" /> : null}
        </div>
        <p className="text-sm font-medium text-secondary">{profile.displayName}</p>
        {profile.bio ? <p className="mt-2 max-w-md text-sm text-secondary">{profile.bio}</p> : null}

        <dl className="mt-4 flex gap-6 text-sm">
          <div>
            <dt className="text-muted">Followers</dt>
            <dd className="font-semibold text-primary">{formatCount(profile.followerCount)}</dd>
          </div>
          <div>
            <dt className="text-muted">Following</dt>
            <dd className="font-semibold text-primary">{formatCount(profile.followingCount)}</dd>
          </div>
          {profile.postCount > 0 ? (
            <div>
              <dt className="text-muted">Posts</dt>
              <dd className="font-semibold text-primary">{formatCount(profile.postCount)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {zoomed ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedAvatar}
            alt={`${profile.displayName}'s profile photo`}
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-lg"
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
