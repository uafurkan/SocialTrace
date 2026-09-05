"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";

import type { Story } from "@/lib/domain/types";
import { mediaDownloadUrl } from "@/lib/media-download-url";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { NotAvailable } from "@/components/profile/not-available";

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h left` : `${minutes}m left`;
}

export function StoryStrip({ stories }: { stories: Story[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (stories.length === 0) {
    return <NotAvailable detail="No active stories right now — stories disappear after 24 hours, so there's honestly nothing to show at this moment." />;
  }

  const active = openIndex !== null ? stories[openIndex] : null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {stories.map((story, index) => (
          <button
            key={story.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-[9/16] overflow-hidden rounded-card border border-border bg-surface-subtle"
          >
            {story.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxiedMediaUrl(story.thumbnailUrl)} alt="" className="size-full object-cover" loading="lazy" />
            ) : null}
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {timeLeft(story.expiresAt)}
            </span>
          </button>
        ))}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <div className="relative max-h-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {active.mediaType === "video" ? (
              <video src={active.mediaUrl} controls autoPlay className="max-h-[80vh] w-full rounded-card" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxiedMediaUrl(active.mediaUrl)} alt="" className="max-h-[80vh] w-full rounded-card object-contain" />
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-white/80">{timeLeft(active.expiresAt)}</span>
              <div className="flex items-center gap-2">
                <a
                  href={mediaDownloadUrl(active.mediaUrl, active.id)}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
                >
                  <Download className="size-4" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setOpenIndex(null)}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
