"use client";

import Script from "next/script";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

/**
 * Google's site-verification requirement is literally "this script tag
 * present in <head> on every page" — `beforeInteractive` is the one
 * next/script strategy Next.js always injects into the document head
 * regardless of where the component sits in the tree, so this satisfies
 * that check without a separate verification meta tag. Renders whenever
 * the client id is set, independent of NEXT_PUBLIC_ADSENSE_ENABLED —
 * verification has to succeed before ads can ever be enabled, so gating
 * this on the same flag would make verification impossible to pass.
 */
export function AdsenseLoader() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      id="adsense-loader"
      strategy="beforeInteractive"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
