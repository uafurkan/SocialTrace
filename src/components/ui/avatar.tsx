"use client";

import { useState } from "react";

import { avatarInitials, avatarPaletteIndex } from "@/lib/avatar-color";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-7 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-10 text-sm",
  xl: "size-20 text-xl",
} as const;

export interface AvatarProps {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * Real photo when we have one; otherwise a deterministic colored-initials
 * fallback (same identity always renders the same color) instead of one
 * flat gray circle everywhere — see docs/SEARCH.md.
 */
export function Avatar({ username, displayName, avatarUrl, size = "md", className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const paletteIndex = avatarPaletteIndex(username.toLowerCase());
  const showImage = Boolean(avatarUrl) && !imageFailed;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        SIZE_CLASSES[size],
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              backgroundColor: `var(--avatar-${paletteIndex}-bg)`,
              color: `var(--avatar-${paletteIndex}-fg)`,
            }
      }
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedMediaUrl(avatarUrl)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{avatarInitials(username, displayName)}</span>
      )}
    </div>
  );
}
