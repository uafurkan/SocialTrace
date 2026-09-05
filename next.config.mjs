import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Real 301s for common misspellings of the brand name landing as a path
   * on this domain (e.g. someone typing socialtrace.com/socialtrce by
   * habit, or a stray inbound link using one). This is a targeted fix for
   * a known, specific typo of our own name — not the doorway-page pattern
   * declined in docs/SEO.md (a page built to rank for many unrelated
   * queries and funnel visitors in); a redirect carries no content to
   * index and both the source and destination clearly refer to the same
   * real site.
   */
  async redirects() {
    const brandMisspellings = [
      "socialtrce",
      "socialtrase",
      "socialtreace",
      "socialtrac",
      "socialtraces",
      "sosyaltrace",
      "sosialtrace",
      "social-trace",
      "socail-trace",
      "socialtack",
      "socialtrak",
    ];
    return brandMisspellings.map((slug) => ({
      source: `/${slug}`,
      destination: "/",
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        // Baseline hardening headers (spec §110 production launch).
        // Content-Security-Policy is set per-request in middleware.ts
        // instead of here — it needs a fresh nonce every request, which a
        // static headers() entry can't produce.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Explicit in app code rather than relying solely on the host
          // (Vercel) to add it at the edge — makes the guarantee portable
          // to any future hosting target. 2 years, all subdomains, and
          // eligible for browser HSTS preload lists.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

/**
 * Sourcemap upload (and everything else that needs a Sentry account: org,
 * project, auth token) stays off unless SENTRY_AUTH_TOKEN is actually set
 * — this wrapper's only job otherwise is wiring up the runtime SDK
 * (instrumentation.ts / instrumentation-client.ts), which works with no
 * Sentry account configured at all (docs/PRODUCTION_HARDENING.md).
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
