"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, X } from "lucide-react";

import type { Comment, Liker } from "@/lib/domain/types";
import { formatCount } from "@/lib/utils";

interface EngagementResponse {
  likers: Liker[];
  comments: Comment[];
}

export function PostEngagementModal({ permalink, onClose }: { permalink: string; onClose: () => void }) {
  const [tab, setTab] = useState<"likers" | "comments">("likers");
  const [data, setData] = useState<EngagementResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // No explicit setData(null)/setError(null) reset here: post-grid.tsx
    // renders this component with key={permalink}, so a permalink change
    // remounts it fresh (initial state) rather than reusing this instance.
    fetch(`/api/v1/posts/engagement?permalink=${encodeURIComponent(permalink)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load");
        return res.json() as Promise<EngagementResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [permalink]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-card border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("likers")}
              className={`rounded-full px-3 py-1 text-sm font-medium ${tab === "likers" ? "bg-brand text-inverse" : "text-secondary hover:bg-surface-subtle"}`}
            >
              Likers{data ? ` (${formatCount(data.likers.length)})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setTab("comments")}
              className={`rounded-full px-3 py-1 text-sm font-medium ${tab === "comments" ? "bg-brand text-inverse" : "text-secondary hover:bg-surface-subtle"}`}
            >
              Comments{data ? ` (${formatCount(data.comments.length)})` : ""}
            </button>
          </div>
          <button type="button" onClick={onClose} className="flex size-7 items-center justify-center rounded-full hover:bg-surface-subtle" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error ? <p className="py-8 text-center text-sm text-muted">{error}</p> : null}
          {!data && !error ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted" />
            </div>
          ) : null}

          {data && tab === "likers" ? (
            data.likers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No likers found.</p>
            ) : (
              <ul className="space-y-2">
                {data.likers.map((liker) => (
                  <li key={liker.username} className="flex items-center gap-2">
                    {liker.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={liker.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="size-8 shrink-0 rounded-full bg-surface-subtle" />
                    )}
                    <span className="truncate text-sm font-medium text-primary">{liker.username}</span>
                    {liker.isVerified ? <BadgeCheck className="size-3.5 shrink-0 text-brand-strong" /> : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {data && tab === "comments" ? (
            data.comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No comments found.</p>
            ) : (
              <ul className="space-y-3">
                {data.comments.map((comment) => (
                  <li key={comment.id} className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-primary">{comment.authorUsername}</span>
                      {comment.authorIsVerified ? <BadgeCheck className="size-3.5 text-brand-strong" /> : null}
                    </div>
                    <p className="text-secondary">{comment.text}</p>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
