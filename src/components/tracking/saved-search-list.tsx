"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, BookmarkPlus, Minus, Plus, Trash2, User } from "lucide-react";

import type { SavedSearchResult } from "@/lib/tracking/saved-searches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function MatchChip({ username, kind, isVerified }: { username: string; kind: "new" | "removed"; isVerified?: boolean }) {
  return (
    <Badge variant={kind === "new" ? "success" : "danger"}>
      {kind === "new" ? <Plus className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
      <User className="size-3" aria-hidden="true" />@{username}
      {isVerified ? <BadgeCheck className="size-3" aria-hidden="true" /> : null}
    </Badge>
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
                <MatchChip key={user.id} username={user.username} kind="new" isVerified={user.isVerified} />
              ))}
              {search.removedMatches.map((user) => (
                <MatchChip key={user.id} username={user.username} kind="removed" />
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
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center">
        <BookmarkPlus className="size-5 text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-secondary">No saved searches yet</p>
        <p className="max-w-sm text-sm text-muted">
          Search a profile&apos;s followers or following, then click &quot;Save search&quot;.
        </p>
      </div>
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
