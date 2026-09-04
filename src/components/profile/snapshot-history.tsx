"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SnapshotSummary } from "@/lib/domain/types";
import { formatCount } from "@/lib/utils";

interface SnapshotHistoryProps {
  profileId: string;
  username: string;
  initialSnapshots: SnapshotSummary[];
}

export function SnapshotHistory({ profileId, username, initialSnapshots }: SnapshotHistoryProps) {
  const router = useRouter();
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setIsCapturing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/profiles/${profileId}/snapshots?username=${encodeURIComponent(username)}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to capture snapshot");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture snapshot");
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-secondary">
          {initialSnapshots.length === 0
            ? "No snapshots captured yet."
            : `${initialSnapshots.length} snapshot${initialSnapshots.length === 1 ? "" : "s"} captured, most recent first.`}
        </p>
        <Button size="sm" onClick={handleCapture} loading={isCapturing} className="sm:w-auto">
          Capture snapshot now
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {initialSnapshots.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-16 text-center text-sm text-muted">
          Capture a snapshot to start recording this profile&apos;s history. Each capture records follower/following
          counts and coverage at that point in time.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Captured</th>
                <th className="px-4 py-3 font-medium">Followers</th>
                <th className="px-4 py-3 font-medium">Following</th>
                <th className="px-4 py-3 font-medium">Posts</th>
                <th className="px-4 py-3 font-medium">Follower coverage</th>
                <th className="px-4 py-3 font-medium">Following coverage</th>
              </tr>
            </thead>
            <tbody>
              {initialSnapshots.map((snapshot) => (
                <tr key={snapshot.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-secondary">{new Date(snapshot.capturedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-primary">{formatCount(snapshot.followerCount)}</td>
                  <td className="px-4 py-3 font-medium text-primary">{formatCount(snapshot.followingCount)}</td>
                  <td className="px-4 py-3 font-medium text-primary">{formatCount(snapshot.postCount)}</td>
                  <td className="px-4 py-3 text-secondary">
                    {snapshot.followerCoveragePercent}% ({formatCount(snapshot.indexedFollowerCount)} indexed)
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {snapshot.followingCoveragePercent}% ({formatCount(snapshot.indexedFollowingCount)} indexed)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
