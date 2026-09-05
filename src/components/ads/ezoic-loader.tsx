"use client";

import Script from "next/script";

/**
 * Loads Ezoic's standalone ad script once, sitewide. Only runs when
 * explicitly opted in (see .env.example / docs/ADS.md) — unset means no
 * script loads and every <AdSlot> below renders nothing, same pattern as
 * every other optional integration in this app.
 */
export function EzoicLoader() {
  if (process.env.NEXT_PUBLIC_EZOIC_ENABLED !== "true") return null;

  return <Script id="ezoic-standalone" src="https://www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" />;
}
