const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

/**
 * Google's AdSense site-verification crawler fetches the raw HTML response
 * and looks for a literal <script src="https://pagead2.googlesyndication.com/...">
 * tag inside <head> — it does not execute JS. next/script's
 * `beforeInteractive` strategy was tried first, but in the App Router it
 * emits its own deferred push-queue call in <body>, not a real <script>
 * tag in <head> (confirmed live: verification failed against the deployed
 * page, and the raw HTML had no <script> element at all, only a
 * `self.__next_s.push([...])` call after </head>). A plain server-rendered
 * <script> element, written directly into the root layout's own <head>,
 * is the only form that actually appears verbatim in the initial HTML.
 *
 * Renders whenever the client id is set, independent of
 * NEXT_PUBLIC_ADSENSE_ENABLED — verification has to succeed before ads can
 * ever be turned on, so gating this on that flag would make verification
 * impossible to pass. `nonce` comes from the per-request CSP nonce
 * (src/proxy.ts) so the script is trusted under the strict-dynamic policy
 * like every other script tag in this app.
 */
export function AdsenseLoader({ nonce }: { nonce: string | null }) {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <script
      async
      nonce={nonce ?? undefined}
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
