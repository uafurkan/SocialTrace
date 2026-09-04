import Link from "next/link";
import { TrendingDown, TrendingUp, User } from "lucide-react";

import type { TrackedProfileSummary } from "@/lib/tracking/watchlist";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";

function DeltaLine({ profile }: { profile: TrackedProfileSummary }) {
  if (profile.followerDeltaSinceLastSnapshot === null) {
    return (
      <p className="text-xs text-muted">
        {profile.latestSnapshotAt
          ? "Capture one more snapshot to see a change since last time."
          : "No snapshots captured yet."}
      </p>
    );
  }
  const delta = profile.followerDeltaSinceLastSnapshot;
  const isUp = delta >= 0;
  return (
    <p className={cn("flex items-center gap-1 text-xs font-medium", isUp ? "text-success" : "text-danger")}>
      {isUp ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
      {isUp ? "+" : ""}
      {formatCount(delta)} since last snapshot
    </p>
  );
}

export function TrackedProfileList({ profiles }: { profiles: TrackedProfileSummary[] }) {
  if (profiles.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-16 text-center text-sm text-muted">
        You&apos;re not tracking any profiles yet. Visit a profile and click &quot;Track profile&quot; to add it
        here.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-card border border-border">
      {profiles.map((profile) => (
        <li key={profile.profileId} className="border-b border-border last:border-0">
          <Link
            href={`/profile/${profile.username}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
          >
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-muted">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <User className="size-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">@{profile.username}</p>
              <p className="truncate text-xs text-muted">
                {formatCount(profile.followerCount)} followers
                {profile.latestSnapshotAt ? ` · last captured ${formatRelativeTime(profile.latestSnapshotAt)}` : ""}
              </p>
            </div>
            <DeltaLine profile={profile} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
