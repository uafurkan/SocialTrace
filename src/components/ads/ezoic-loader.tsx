"use client";

import Script from "next/script";

/**
 * Ezoic's official integration order (docs "Step 2: Site Integration"):
 * privacy/consent scripts first, then the standalone header script, then
 * analytics — each depends on the previous one having registered first.
 * next/script preserves render order within a strategy, so this list's
 * order matters. Only runs when explicitly opted in (see .env.example /
 * docs/ADS.md) — unset means none of this loads and every <AdSlot> below
 * renders nothing, same pattern as every other optional integration here.
 */
export function EzoicLoader() {
  if (process.env.NEXT_PUBLIC_EZOIC_ENABLED !== "true") return null;

  return (
    <>
      <Script
        id="ezoic-privacy-gatekeeper"
        src="https://cmp.gatekeeperconsent.com/min.js"
        data-cfasync="false"
        strategy="afterInteractive"
      />
      <Script
        id="ezoic-privacy-cmp"
        src="https://the.gatekeeperconsent.com/cmp.min.js"
        data-cfasync="false"
        strategy="afterInteractive"
      />
      <Script id="ezoic-standalone-init" strategy="afterInteractive">
        {"window.ezstandalone = window.ezstandalone || {}; window.ezstandalone.cmd = window.ezstandalone.cmd || [];"}
      </Script>
      <Script id="ezoic-standalone" src="https://www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" />
      <Script id="ezoic-analytics" src="https://ezoicanalytics.com/analytics.js" strategy="afterInteractive" />
    </>
  );
}
