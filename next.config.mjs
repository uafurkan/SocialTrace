import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * yt-dlp-exec and ffmpeg-static both resolve their bundled binary's path
   * off `__dirname` at require-time (see src/lib/transcription/downloader.ts's
   * local yt-dlp last-resort fallback). Turbopack's default bundling
   * inlines/rewrites `__dirname` for bundled node_modules code — confirmed
   * live this session: the compiled output baked in the literal path
   * "/ROOT/node_modules/yt-dlp-exec/bin/yt-dlp" (a build-cache placeholder
   * root, not this project's real path), so the binary could never be
   * found at runtime (`spawn ... ENOENT`), silently breaking the one
   * fallback this feature exists for — "if every paid Apify actor is
   * down/over budget, still transcribe via a local yt-dlp+ffmpeg." Listing
   * these as external keeps them as real `require()` calls against the
   * actual on-disk node_modules at runtime instead of bundled/rewritten
   * code, which is Next's documented fix for exactly this class of
   * native-binary-resolving package.
   */
  serverExternalPackages: ["yt-dlp-exec", "ffmpeg-static"],
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
