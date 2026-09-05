"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import type { Highlight } from "@/lib/domain/types";
import { mediaDownloadUrl } from "@/lib/media-download-url";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { NotAvailable } from "@/components/profile/not-available";

export function HighlightGrid({ highlights }: { highlights: Highlight[] }) {
  const [openHighlight, setOpenHighlight] = useState<number | null>(null);
  const [itemIndex, setItemIndex] = useState(0);

  if (highlights.length === 0) {
    return <NotAvailable detail="No saved highlights on this profile right now." />;
  }

  const active = openHighlight !== null ? highlights[openHighlight] : null;
  const activeItem = active ? active.items[itemIndex] : null;

  function close() {
    setOpenHighlight(null);
    setItemIndex(0);
  }

  function open(index: number) {
    setOpenHighlight(index);
    setItemIndex(0);
  }

  function step(delta: number) {
    if (!active) return;
    const next = itemIndex + delta;
    if (next < 0 || next >= active.items.length) return;
    setItemIndex(next);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {highlights.map((highlight, index) => (
          <button
            key={highlight.id}
            type="button"
            onClick={() => open(index)}
            className="flex flex-col items-center gap-1.5 text-center"
            disabled={highlight.items.length === 0}
          >
            <span className="relative aspect-square w-full overflow-hidden rounded-full border-2 border-border bg-surface-subtle">
              {highlight.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxiedMediaUrl(highlight.coverUrl)} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
            </span>
            <span className="line-clamp-1 text-xs font-medium text-secondary">{highlight.title}</span>
          </button>
        ))}
      </div>

      {active && activeItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div className="relative max-h-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {activeItem.mediaType === "video" ? (
              <video src={activeItem.mediaUrl} controls autoPlay className="max-h-[80vh] w-full rounded-card" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxiedMediaUrl(activeItem.mediaUrl)} alt="" className="max-h-[80vh] w-full rounded-card object-contain" />
            )}

            {active.items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={itemIndex === 0}
                  className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={itemIndex === active.items.length - 1}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                  aria-label="Next"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-white/80">
                {active.title} · {itemIndex + 1}/{active.items.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={mediaDownloadUrl(activeItem.mediaUrl, activeItem.id)}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
                >
                  <Download className="size-4" /> Download
                </a>
                <button
                  type="button"
                  onClick={close}
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
