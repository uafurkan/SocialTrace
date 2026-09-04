"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The in-app notification for tracked-profile/saved-search activity
 * (docs/SCHEDULER.md) — a small count badge next to the "Track" nav
 * link, rather than email/push (no email service configured). Polls
 * lazily: fetched once on mount and again on every client-side route
 * change, same pattern as AccountMenu and for the same reason (this
 * component persists across navigation, so a plain empty-deps effect
 * would never notice new activity after a cron capture ran).
 */
export function TrackNavBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/tracking/summary")
      .then((res) => res.json())
      .then((data: { available: boolean; count: number }) => {
        if (!cancelled) setCount(data.available ? data.count : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (count <= 0) return null;

  return (
    <span
      className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-inverse"
      aria-label={`${count} new tracked-profile or saved-search change${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
