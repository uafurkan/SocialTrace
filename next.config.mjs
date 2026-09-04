import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
