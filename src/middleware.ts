import { NextRequest, NextResponse } from "next/server";

/**
 * A real Content Security Policy, not the placeholder previously deferred
 * in docs/PRODUCTION_HARDENING.md ("a CSP written now would either be
 * trivial or need rewriting the moment something is added"). Nothing was
 * added since — this app has zero third-party scripts, zero inline event
 * handlers, and confirmed zero external <script>/<iframe> usage — so a
 * real, non-trivial CSP is possible today: per-request nonce for
 * script-src (Next.js's App Router needs this for its own hydration
 * payload scripts — it auto-applies the nonce from this header to those,
 * see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy),
 * 'strict-dynamic' so nonce'd scripts can load their own children without
 * a wider script-src.
 *
 * style-src keeps 'unsafe-inline': Framer Motion (the hero chart's
 * animation) sets inline `style` attributes directly for transforms, and
 * nonce'ing every one of those isn't practical. This is the one
 * deliberate loosening — style-src is a much lower-severity XSS vector
 * than script-src, which stays nonce-only.
 *
 * img-src allows any https origin (not just 'self'): a real provider's
 * avatar URLs are Instagram's CDN, on numerous rotating subdomains that
 * can't be enumerated (docs/PROVIDER_CONTRACT.md) — the mock provider
 * emits no avatarUrl at all, so this only matters once SOCIAL_PROVIDER=apify.
 *
 * Deliberately NOT running middleware on /api/* — those responses aren't
 * HTML, so a script/style CSP doesn't apply to them, and skipping the
 * nonce generation there avoids pointless per-request overhead on the
 * highest-traffic paths.
 *
 * frame-src/connect-src only widen to any https origin when
 * NEXT_PUBLIC_EZOIC_ENABLED=true (see docs/ADS.md) — Ezoic's ad exchanges
 * serve creatives from a large, non-enumerable set of ad-server domains
 * in cross-origin iframes and make their own bidding/tracking requests,
 * the same "can't allowlist specific hosts" situation as img-src's avatar
 * CDN allowance above. script-src's 'strict-dynamic' already lets the
 * nonce'd Ezoic loader pull in whatever child scripts it needs without
 * widening script-src itself. With ads disabled (the default), the
 * policy stays at its strict 'self'-only baseline.
 *
 * Turnstile (NEXT_PUBLIC_TURNSTILE_SITE_KEY, see docs/AUTH.md) is a
 * single known host, so unlike Ezoic it gets an explicit allowlist entry
 * (challenges.cloudflare.com) instead of widening to any https origin —
 * it's independent of the ads flag since bot protection on login/signup
 * shouldn't depend on whether ad monetization is on.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const adsEnabled = process.env.NEXT_PUBLIC_EZOIC_ENABLED === "true";
  // Turnstile's challenge widget renders in its own iframe from
  // challenges.cloudflare.com — that host needs frame-src even with ads
  // off, since bot protection on login/signup is independent of the ad
  // integration. script-src doesn't need it explicitly: the nonce'd
  // <Script> loading api.js is trusted directly by nonce match.
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const frameSrc = adsEnabled
    ? "https:"
    : turnstileEnabled
      ? "'self' https://challenges.cloudflare.com"
      : "'self'";
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data:;
    font-src 'self';
    connect-src 'self'${adsEnabled ? " https:" : turnstileEnabled ? " https://challenges.cloudflare.com" : ""};
    frame-src ${frameSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
