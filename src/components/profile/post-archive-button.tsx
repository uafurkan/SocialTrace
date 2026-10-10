"use client";

import { useState } from "react";
import { Archive } from "lucide-react";

import type { Post } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { buildArchive, collectPostMedia, MAX_ARCHIVE_BYTES } from "@/lib/posts/archive";

/** Fetches through our own media proxy, which keeps the same host allowlist as the download route. */
async function fetchThroughProxy(url: string): Promise<Blob> {
  const res = await fetch(`/api/v1/media/proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Media request failed with ${res.status}`);
  return res.blob();
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Packs the posts currently shown into one ZIP, one file per post, in the
 * order shown. Runs entirely in the browser; each file is fetched one at a time.
 */
export function PostArchiveButton({ posts }: { posts: Post[] }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const withMedia = posts.filter((post) => post.mediaUrl).length;

  async function handleClick() {
    setRunning(true);
    setMessage(null);
    setProgress({ done: 0, total: posts.length });
    try {
      const collected = await collectPostMedia(posts, fetchThroughProxy, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (collected.entries.length === 0) {
        setMessage("None of these posts had a file we could download.");
        return;
      }

      const zip = buildArchive(collected.entries);
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `socialtrace-posts-${todayStamp()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const parts = [`Saved ${collected.entries.length} of ${posts.length} posts.`];
      if (collected.skipped > 0) parts.push(`${collected.skipped} had no file we could fetch.`);
      if (collected.truncated) {
        parts.push(`Stopped at the ${Math.round(MAX_ARCHIVE_BYTES / (1024 * 1024))} MB limit. Narrow the list to get the rest.`);
      }
      setMessage(parts.join(" "));
    } catch {
      setMessage("Something went wrong while building the archive. Please try again.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={handleClick} disabled={running || withMedia === 0} loading={running}>
        <Archive className="size-4" />
        {running && progress
          ? `Packing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
          : `Download ZIP (${withMedia})`}
      </Button>
      {message ? <p className="max-w-xs text-right text-xs text-muted">{message}</p> : null}
    </div>
  );
}
