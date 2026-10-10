"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import type { SnapshotSummary } from "@/lib/domain/types";
import type { ComparisonSnapshot, FollowerComparisonResult, ProfileFieldChange } from "@/lib/diff/compare";
import { Button } from "@/components/ui/button";
import { cn, formatCount } from "@/lib/utils";

interface SnapshotComparerProps {
  profileId: string;
  username: string;
  snapshots: SnapshotSummary[];
}

const KINDS = ["follower", "following"] as const;
type Kind = (typeof KINDS)[number];

const COUNT_NAMES: Record<Kind, string> = { follower: "Followers", following: "Following" };

const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  displayName: "Display name",
  bio: "Bio",
  avatarUrl: "Avatar",
  isVerified: "Verified status",
  isPrivate: "Privacy",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function label(snapshot: SnapshotSummary): string {
  return formatTimestamp(snapshot.capturedAt);
}

/** Follower or following count stored on one snapshot in the comparison result. */
function countOf(snapshot: ComparisonSnapshot, kind: Kind): number {
  return kind === "follower" ? snapshot.followerCount : snapshot.followingCount;
}

/** Signed count change, such as +1.2K or -350. */
function formatChange(delta: number): string {
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : "-"}${formatCount(Math.abs(delta))}`;
}

function changeTone(delta: number): string {
  if (delta > 0) return "text-success";
  if (delta < 0) return "text-danger";
  return "text-primary";
}

function FieldChangeRow({ change }: { change: ProfileFieldChange }) {
  const fieldLabel = FIELD_LABELS[change.field] ?? change.field;
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
        <Pencil className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{fieldLabel} changed</p>
        <p className="truncate text-xs text-muted">
          <span className="line-through">{change.oldValue || "(empty)"}</span> → {change.newValue || "(empty)"}
        </p>
      </div>
      <p className="shrink-0 text-xs text-muted">{formatTimestamp(change.detectedAt)}</p>
    </li>
  );
}

function ComparisonView({ result }: { result: FollowerComparisonResult }) {
  const selectedName = COUNT_NAMES[result.kind];
  const earlierCount = countOf(result.from, result.kind);
  const laterCount = countOf(result.to, result.kind);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-card border border-border p-4 text-center">
          <p className="text-2xl font-semibold text-primary">{formatCount(earlierCount)}</p>
          <p className="mt-1 text-xs text-muted">{selectedName}, earlier</p>
        </div>
        <div className="rounded-card border border-border p-4 text-center">
          <p className="text-2xl font-semibold text-primary">{formatCount(laterCount)}</p>
          <p className="mt-1 text-xs text-muted">{selectedName}, later</p>
        </div>
        <div className="rounded-card border border-border p-4 text-center">
          <p className={cn("text-2xl font-semibold", changeTone(result.countChange))}>
            {formatChange(result.countChange)}
          </p>
          <p className="mt-1 text-xs text-muted">{selectedName} change</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Follower and following counts at both snapshots</caption>
          <thead className="bg-surface-subtle text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Count
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                {formatTimestamp(result.from.capturedAt)}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                {formatTimestamp(result.to.capturedAt)}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map((kind) => {
              const before = countOf(result.from, kind);
              const after = countOf(result.to, kind);
              const delta = after - before;
              return (
                <tr key={kind} className="border-t border-border">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-primary">
                    {COUNT_NAMES[kind]}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-primary">{formatCount(before)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-primary">{formatCount(after)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", changeTone(delta))}>
                    {formatChange(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium text-primary">Profile changes</h3>
        {result.fieldChanges.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center text-sm text-muted">
            No profile-field changes were recorded between these two snapshots.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card border border-border">
            {result.fieldChanges.map((change) => (
              <FieldChangeRow key={`${change.detectedAt}-${change.field}`} change={change} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Only counts and profile fields are compared. Individual accounts are not listed.
        </p>
      </section>
    </div>
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
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (fromId === toId) {
      setError("Pick two different snapshots to compare.");
      return;
    }
    setIsPending(true);
    setError(null);
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
          <label className="mb-1 block text-xs font-medium text-muted">Highlight</label>
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

      {result ? <ComparisonView result={result} /> : null}
    </div>
  );
}
