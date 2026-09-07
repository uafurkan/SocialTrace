"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ezstandalone?: {
      cmd: Array<() => void>;
      showAds: (...placementIds: number[]) => void;
    };
    adsbygoogle?: unknown[];
  }
}

const EZOIC_ENABLED = process.env.NEXT_PUBLIC_EZOIC_ENABLED === "true";
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// One ad unit id per placement, created in the AdSense dashboard — set only
// for the placements actually wired up below (see .env.example).
const ADSENSE_SLOT_IDS: Record<number, string | undefined> = {
  100: process.env.NEXT_PUBLIC_ADSENSE_SLOT_100,
  101: process.env.NEXT_PUBLIC_ADSENSE_SLOT_101,
  102: process.env.NEXT_PUBLIC_ADSENSE_SLOT_102,
  103: process.env.NEXT_PUBLIC_ADSENSE_SLOT_103,
  104: process.env.NEXT_PUBLIC_ADSENSE_SLOT_104,
  105: process.env.NEXT_PUBLIC_ADSENSE_SLOT_105,
  106: process.env.NEXT_PUBLIC_ADSENSE_SLOT_106,
  107: process.env.NEXT_PUBLIC_ADSENSE_SLOT_107,
  108: process.env.NEXT_PUBLIC_ADSENSE_SLOT_108,
  109: process.env.NEXT_PUBLIC_ADSENSE_SLOT_109,
  110: process.env.NEXT_PUBLIC_ADSENSE_SLOT_110,
  111: process.env.NEXT_PUBLIC_ADSENSE_SLOT_111,
};

/**
 * One in-content display ad placement (see docs/ADS.md). `placementId`
 * must be unique per slot on the page and match the number assigned to
 * this position in the Ezoic dashboard's Ad Tester (and, for AdSense, the
 * ad unit mapped to it via NEXT_PUBLIC_ADSENSE_SLOT_<id>).
 *
 * Ezoic takes priority whenever both are enabled — never render two ad
 * networks' creatives in the same slot at once (both networks' terms
 * prohibit exactly that), so AdSense only renders here while Ezoic is off.
 * This is meant as a parallel path while Ezoic's Incubator review is
 * pending, not a permanent dual setup.
 *
 * Every slot here sits in normal document flow so it never overlaps content
 * or blocks a tap target on mobile. The reserved min-height avoids layout
 * shift while the ad loads in, and the "Advertisement" label keeps it
 * honestly distinguishable from real content. The one exception is the
 * mobile anchor bar (`AnchorAdSlot`, placement 101) — a real fixed-position
 * format both networks natively support and document as one of the
 * highest-RPM placements (Ezoic/AdSense "anchor ads"), built as its own
 * dismissible component rather than a variant of this one, precisely
 * because it needs different rules (close button, session-scoped dismissal,
 * z-index below any modal) than everything in-flow below.
 */
export function AdSlot({
  placementId,
  className,
  compact,
}: {
  placementId: number;
  className?: string;
  /** A short, flush strip with no card chrome and a small fixed min-height — for the mobile anchor bar (`AnchorAdSlot`) rather than an in-content slot. */
  compact?: boolean;
}) {
  const adsenseSlotId = ADSENSE_SLOT_IDS[placementId];
  const useAdsense = !EZOIC_ENABLED && ADSENSE_ENABLED && Boolean(ADSENSE_CLIENT_ID) && Boolean(adsenseSlotId);

  useEffect(() => {
    if (EZOIC_ENABLED) {
      window.ezstandalone = window.ezstandalone || { cmd: [], showAds: () => {} };
      window.ezstandalone.cmd.push(() => {
        window.ezstandalone?.showAds(placementId);
      });
      return;
    }
    if (useAdsense) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // adsbygoogle script not loaded yet or blocked by the viewer — the
        // slot just stays empty rather than throwing.
      }
    }
  }, [placementId, useAdsense]);

  if (!EZOIC_ENABLED && !useAdsense) return null;

  if (compact) {
    return (
      <div className={`w-full ${className ?? ""}`}>
        {EZOIC_ENABLED ? (
          <div id={`ezoic-pub-ad-placeholder-${placementId}`} className="min-h-[50px]" />
        ) : (
          <ins
            className="adsbygoogle block min-h-[50px]"
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={adsenseSlotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${className ?? ""}`}>
      <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">Advertisement</p>
      {EZOIC_ENABLED ? (
        <div
          id={`ezoic-pub-ad-placeholder-${placementId}`}
          className="min-h-[100px] rounded-card border border-dashed border-border-strong bg-surface-subtle sm:min-h-[250px]"
        />
      ) : (
        <ins
          className="adsbygoogle block min-h-[100px] sm:min-h-[250px]"
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={adsenseSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
