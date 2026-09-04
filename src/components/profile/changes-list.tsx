import { BadgeCheck, Pencil, UserMinus, UserPlus } from "lucide-react";

import type { ChangeEvent } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface ChangesListProps {
  changes: ChangeEvent[];
}

const FIELD_LABELS: Record<string, string> = {
  displayName: "Display name",
  bio: "Bio",
  avatarUrl: "Avatar",
  isVerified: "Verified status",
  isPrivate: "Privacy",
};

function MembershipRow({ change }: { change: ChangeEvent }) {
  const isAdded = change.membershipEvent === "added";
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isAdded ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        {isAdded ? <UserPlus className="size-4" aria-hidden="true" /> : <UserMinus className="size-4" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-primary">
            @{change.user?.username ?? "unknown"}
          </p>
          {change.user?.isVerified ? <BadgeCheck className="size-3.5 shrink-0 text-info" /> : null}
        </div>
        <p className="text-xs text-muted">
          {isAdded ? "Started" : "Stopped"} {change.membershipKind === "follower" ? "following this profile" : "being followed"}
        </p>
      </div>
      <p className="shrink-0 text-xs text-muted">{new Date(change.detectedAt).toLocaleString()}</p>
    </li>
  );
}

function FieldChangeRow({ change }: { change: ChangeEvent }) {
  const label = FIELD_LABELS[change.field ?? ""] ?? change.field;
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
        <Pencil className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{label} changed</p>
        <p className="truncate text-xs text-muted">
          <span className="line-through">{change.oldValue || "(empty)"}</span> → {change.newValue || "(empty)"}
        </p>
      </div>
      <p className="shrink-0 text-xs text-muted">{new Date(change.detectedAt).toLocaleString()}</p>
    </li>
  );
}

export function ChangesList({ changes }: ChangesListProps) {
  if (changes.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-16 text-center text-sm text-muted">
        No changes detected yet. Changes are computed automatically each time a new snapshot is captured (see the
        History tab) and compared against the previous one — capture at least two snapshots to see anything here.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-secondary">
        {changes.length} change{changes.length === 1 ? "" : "s"}, most recent first.
      </p>
      <ul className="overflow-hidden rounded-card border border-border">
        {changes.map((change) =>
          change.membershipEvent ? (
            <MembershipRow key={change.id} change={change} />
          ) : (
            <FieldChangeRow key={change.id} change={change} />
          ),
        )}
      </ul>
    </div>
  );
}
