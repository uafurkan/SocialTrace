"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, TrendingDown, TrendingUp } from "lucide-react";

import type { SnapshotSummary, SocialUser } from "@/lib/domain/types";
import type { FollowerComparisonResult } from "@/lib/diff/compare";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatCount } from "@/lib/utils";

interface SnapshotComparerProps {
  profileId: string;
  username: string;
  snapshots: SnapshotSummary[];
}

const KINDS = ["follower", "following"] as const;
type Kind = (typeof KINDS)[number];
type ResultTab = "overview" | "new" | "removed";

function label(snapshot: SnapshotSummary): string {
  return new Date(snapshot.capturedAt).toLocaleString();
}

function MemberRow({ user }: { user: SocialUser }) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
      <Avatar username={user.username} displayName={user.displayName} avatarUrl={user.avatarUrl} size="xs" />
      <p className="truncate text-sm font-medium text-primary">@{user.username}</p>
      {user.isVerified ? <BadgeCheck className="size-3.5 shrink-0 text-info" /> : null}
    </li>
  );
}

export function SnapshotComparer({ username, snapshots }: SnapshotComparerProps) {
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()),
    [snapshots],
  );
  const [fromId, setFromId] = useState(sorted[0].id);
  const [toId, setToId] = useState(sorted[sorted.length - 1].id);
  const [kind, setKind] = useState<Kind>("follower");
  const [result, setResult] = useState<FollowerComparisonResult | null>(null);
  const [tab, setTab] = useState<ResultTab>("overview");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (fromId === toId) {
      setError("Pick two different snapshots to compare.");
      return;
    }
    setIsPending(true);
    setError(null);
    setTab("overview");
    try {
      const params = new URLSearchParams({ username, kind, from: fromId, to: toId });
      const res = await fetch(`/api/v1/profiles/x/compare?${params.toString()}`);
      const data = (await res.json()) as FollowerComparisonResult | { error: string };
      if (!res.ok) throw new Error("error" in data ? data.error : "Comparison failed");
      setResult(data as FollowerComparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-card border border-border p-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">From</label>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="h-10 w-full rounded-button border border-border bg-surface px-3 text-sm text-primary"
          >
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">To</label>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="h-10 w-full rounded-button border border-border bg-surface px-3 text-sm text-primary"
          >
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dataset</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="h-10 rounded-button border border-border bg-surface px-3 text-sm text-primary"
          >
            <option value="follower">Followers</option>
            <option value="following">Following</option>
          </select>
        </div>
        <Button variant="primary" onClick={handleCompare} loading={isPending}>
          Compare
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {result ? (
        result.available ? (
          <div className="mt-6">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-card border border-border p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-semibold text-success">
                  <TrendingUp className="size-5" aria-hidden="true" />
                  {formatCount(result.newMembers.length)}
                </p>
                <p className="mt-1 text-xs text-muted">New</p>
              </div>
              <div className="rounded-card border border-border p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-semibold text-danger">
                  <TrendingDown className="size-5" aria-hidden="true" />
                  {formatCount(result.removedMembers.length)}
                </p>
                <p className="mt-1 text-xs text-muted">Removed</p>
              </div>
              <div className="rounded-card border border-border p-4 text-center">
                <p className={cn("text-2xl font-semibold", result.netChange >= 0 ? "text-success" : "text-danger")}>
                  {result.netChange >= 0 ? "+" : ""}
                  {formatCount(result.netChange)}
                </p>
                <p className="mt-1 text-xs text-muted">Net change</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {(["overview", "new", "removed"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? "secondary" : "tertiary"}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                >
                  {t === "overview" ? "Overview" : t === "new" ? "New" : "Removed"}
                </Button>
              ))}
            </div>

            <div className="mt-3">
              {tab === "overview" ? (
                <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center text-sm text-muted">
                  {formatCount(result.newMembers.length)} gained, {formatCount(result.removedMembers.length)} lost
                  between {new Date(result.from.capturedAt).toLocaleDateString()} and{" "}
                  {new Date(result.to.capturedAt).toLocaleDateString()}. Switch to the New or Removed tab to see who.
                </p>
              ) : tab === "new" ? (
                result.newMembers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">No new {kind}s in this range.</p>
                ) : (
                  <ul className="overflow-hidden rounded-card border border-border">
                    {result.newMembers.map((u) => (
                      <MemberRow key={u.id} user={u} />
                    ))}
                  </ul>
                )
              ) : result.removedMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No removed {kind}s in this range.</p>
              ) : (
                <ul className="overflow-hidden rounded-card border border-border">
                  {result.removedMembers.map((u) => (
                    <MemberRow key={u.id} user={u} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center text-sm text-muted">
            {result.reason}
          </p>
        )
      ) : null}
    </div>
  );
}
