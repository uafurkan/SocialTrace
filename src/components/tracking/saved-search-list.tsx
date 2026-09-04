"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Trash2, User } from "lucide-react";

import type { SavedSearchResult } from "@/lib/tracking/saved-searches";
import { Button } from "@/components/ui/button";

function MatchChip({ username }: { username: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-xs text-secondary">
      <User className="size-3" aria-hidden="true" />@{username}
    </span>
  );
}

function SavedSearchRow({ search, onDeleted }: { search: SavedSearchResult; onDeleted: (id: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/saved-searches/${search.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(search.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <li className="border-b border-border px-4 py-3 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">
            <Link href={`/profile/${search.username}`} className="hover:underline">
              @{search.username}
            </Link>{" "}
            <span className="text-muted">· {search.kind === "follower" ? "followers" : "following"} ·</span>{" "}
            &quot;{search.query}&quot;
          </p>
        </div>
        <Button variant="tertiary" size="sm" onClick={handleDelete} loading={isDeleting} aria-label="Delete saved search">
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {search.available ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {search.newMatches.length === 0 && search.removedMatches.length === 0 ? (
            <span className="text-xs text-muted">No matching changes since the last snapshot.</span>
          ) : (
            <>
              {search.newMatches.map((user) => (
                <span key={user.id} className="inline-flex items-center gap-1 text-xs text-success">
                  +<MatchChip username={user.username} />
                  {user.isVerified ? <BadgeCheck className="size-3" aria-hidden="true" /> : null}
                </span>
              ))}
              {search.removedMatches.map((user) => (
                <span key={user.id} className="inline-flex items-center gap-1 text-xs text-danger">
                  −<MatchChip username={user.username} />
                </span>
              ))}
            </>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">{search.reason}</p>
      )}
    </li>
  );
}

export function SavedSearchList({ searches: initialSearches }: { searches: SavedSearchResult[] }) {
  const [searches, setSearches] = useState(initialSearches);

  if (searches.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center text-sm text-muted">
        No saved searches yet. Search a profile&apos;s followers or following, then click &quot;Save search&quot;.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-card border border-border">
      {searches.map((search) => (
        <SavedSearchRow
          key={search.id}
          search={search}
          onDeleted={(id) => setSearches((prev) => prev.filter((s) => s.id !== id))}
        />
      ))}
    </ul>
  );
}
