"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ezstandalone?: {
      cmd: Array<() => void>;
      showAds: (...placementIds: number[]) => void;
    };
  }
}

const EZOIC_ENABLED = process.env.NEXT_PUBLIC_EZOIC_ENABLED === "true";

/**
 * One in-content display ad placement (see docs/ADS.md). `placementId`
 * must be unique per slot on the page and match the number assigned to
 * this position in the Ezoic dashboard's Ad Tester.
 *
 * Deliberately no sticky/anchor/interstitial variant here — every slot in
 * this app sits in normal document flow so it never overlaps content or
 * blocks a tap target on mobile. The reserved min-height avoids layout
 * shift while the ad loads in, and the "Advertisement" label keeps it
 * honestly distinguishable from real content.
 */
export function AdSlot({ placementId, className }: { placementId: number; className?: string }) {
  useEffect(() => {
    if (!EZOIC_ENABLED) return;
    window.ezstandalone = window.ezstandalone || { cmd: [], showAds: () => {} };
    window.ezstandalone.cmd.push(() => {
      window.ezstandalone?.showAds(placementId);
    });
  }, [placementId]);

  if (!EZOIC_ENABLED) return null;

  return (
    <div className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${className ?? ""}`}>
      <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">Advertisement</p>
      <div
        id={`ezoic-pub-ad-placeholder-${placementId}`}
        className="min-h-[100px] rounded-card border border-dashed border-border-strong bg-surface-subtle sm:min-h-[250px]"
      />
    </div>
  );
}
