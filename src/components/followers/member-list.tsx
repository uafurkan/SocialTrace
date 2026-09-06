"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BadgeCheck, Bookmark, Search } from "lucide-react";

import type { CursorPage, SocialUser } from "@/lib/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

interface MemberListProps {
  profileId: string;
  username: string;
  kind: "followers" | "following";
  dbAvailable: boolean;
  /** Which pagination route to hit — lets non-Instagram platforms reuse this whole component against their own route. */
  apiBasePath?: string;
  /** Saved searches only make sense where the snapshot/diff engine also runs (Instagram only, for now) — hides the action entirely elsewhere rather than saving a search that will never get new/removed matches. */
  supportsSavedSearch?: boolean;
}

const SAVED_SEARCH_KIND: Record<MemberListProps["kind"], "follower" | "following"> = {
  followers: "follower",
  following: "following",
};

const FILTERS = ["all", "verified", "new", "removed"] as const;
type Filter = (typeof FILTERS)[number];

async function fetchPage(
  apiBasePath: string,
  profileId: string,
  kind: MemberListProps["kind"],
  cursor: string | null,
  query: string,
) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (query) params.set("q", query);
  const res = await fetch(`${apiBasePath}/${profileId}/${kind}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load list");
  return (await res.json()) as CursorPage<SocialUser>;
}

export function MemberList({
  profileId,
  username,
  kind,
  dbAvailable,
  apiBasePath = "/api/v1/profiles",
  supportsSavedSearch = true,
}: MemberListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<SocialUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const parentRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSaveSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSaveState("saving");
    try {
      const params = new URLSearchParams({ username, kind: SAVED_SEARCH_KIND[kind], query: trimmed });
      const res = await fetch(`/api/v1/saved-searches?${params.toString()}`, { method: "POST" });
      setSaveState(res.ok ? "saved" : "idle");
    } catch {
      setSaveState("idle");
    }
  }

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      fetchPage(apiBasePath, profileId, kind, null, query).then((page) => {
        if (cancelled) return;
        const filtered = filter === "verified" ? page.items.filter((u) => u.isVerified) : page.items;
        setItems(filtered);
        setNextCursor(page.nextCursor);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [profileId, kind, query, filter, apiBasePath]);

  async function loadMore() {
    if (!nextCursor) return;
    const page = await fetchPage(apiBasePath, profileId, kind, nextCursor, query);
    setItems((prev) => [...prev, ...(filter === "verified" ? page.items.filter((u) => u.isVerified) : page.items)]);
    setNextCursor(page.nextCursor);
  }

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const placeholder =
    kind === "followers" ? copy.followers.searchPlaceholder : copy.followers.searchPlaceholderFollowing;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSaveState("idle");
            }}
            placeholder={placeholder}
            className="pl-9"
            aria-label={placeholder}
          />
        </div>
        {supportsSavedSearch && dbAvailable && query.trim() ? (
          <Button
            variant="tertiary"
            size="sm"
            onClick={handleSaveSearch}
            loading={saveState === "saving"}
            disabled={saveState === "saved"}
            title="Save this search to see new/removed matches on future snapshots"
          >
            <Bookmark className="size-4" aria-hidden="true" />
            {saveState === "saved" ? "Saved" : "Save search"}
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const disabled = f === "new" || f === "removed";
          return (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "secondary" : "tertiary"}
              disabled={disabled}
              title={disabled ? copy.followers.filterUnavailableTooltip : undefined}
              onClick={() => !disabled && setFilter(f)}
              aria-pressed={filter === f}
            >
              {copy.followers.filters[f]}
            </Button>
          );
        })}
      </div>

      {items.length === 0 && !isPending ? (
        <p className="py-12 text-center text-sm text-muted">{copy.emptyStates.noResults}</p>
      ) : (
        <div ref={parentRef} className="h-[480px] overflow-y-auto rounded-card border border-border">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const user = items[row.index];
              return (
                <div
                  key={user.id}
                  className="absolute left-0 top-0 flex w-full items-center gap-3 border-b border-border px-4 last:border-0"
                  style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                >
                  <Avatar
                    username={user.username}
                    displayName={user.displayName}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-primary">@{user.username}</p>
                      {user.isVerified ? <BadgeCheck className="size-3.5 shrink-0 text-info" /> : null}
                    </div>
                    <p className="truncate text-xs text-muted">{user.displayName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
