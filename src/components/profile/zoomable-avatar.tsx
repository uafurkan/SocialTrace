"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { proxiedMediaUrl } from "@/lib/media-proxy";

interface ZoomableAvatarProps {
  username: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Profile photo that opens full-size on click, shared by every platform header.
 * Falls back to the initials avatar (and stays inert) when no photo is available.
 */
export function ZoomableAvatar({ username, displayName, avatarUrl }: ZoomableAvatarProps) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomed]);

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-label="View full-size profile photo"
        disabled={!avatarUrl}
      >
        <Avatar username={username} displayName={displayName} avatarUrl={avatarUrl} size="xl" className="border border-border" />
      </button>

      {zoomed && avatarUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName}'s profile photo`}
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedMediaUrl(avatarUrl)}
            alt={`${displayName}'s profile photo`}
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-lg"
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </>
  );
}
