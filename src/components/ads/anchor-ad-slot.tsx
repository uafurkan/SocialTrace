"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { AdSlot } from "./ad-slot";

const EZOIC_ENABLED = process.env.NEXT_PUBLIC_EZOIC_ENABLED === "true";
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
const ANCHOR_PLACEMENT_ID = 101;
const DISMISS_KEY = "ad-anchor-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A mobile-only sticky bottom-anchor ad — the format both Ezoic and AdSense
 * document as one of the single highest-RPM placements they offer, since it
 * stays in view through the whole scroll rather than being seen once and
 * scrolled past. Manually built here (rather than opted into via each
 * network's own auto-anchor toggle) so it can guarantee the same
 * requirement both networks' policies mandate for this format: a real,
 * always-visible close button, never covering primary navigation or a tap
 * target. Desktop gets no anchor bar at all — the format exists because
 * mobile viewports have no sidebar to hold a persistent unit in, which
 * desktop already doesn't need.
 *
 * Dismissal is per-tab (`sessionStorage`) — closing it once keeps it closed
 * for the rest of that browsing session without ever needing to ask again,
 * but a fresh visit later still gets the chance to show it once.
 */
export function AnchorAdSlot() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);

  if (!EZOIC_ENABLED && !ADSENSE_ENABLED) return null;
  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.08)] sm:hidden">
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // sessionStorage unavailable — closing still hides it for this
            // render, it just may reappear on the next page load.
          }
          setDismissed(true);
        }}
        aria-label="Close advertisement"
        className="absolute right-1 top-1 z-10 flex size-6 items-center justify-center rounded-full bg-surface-subtle text-muted shadow-sm"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-2 px-8 py-1">
        <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted">Ad</span>
        <AdSlot placementId={ANCHOR_PLACEMENT_ID} compact />
      </div>
    </div>
  );
}
