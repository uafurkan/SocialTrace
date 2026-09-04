import * as Sentry from "@sentry/nextjs";

/**
 * Real Sentry, opt-in via SENTRY_DSN — the same "real integration, honest
 * default" pattern as SOCIAL_PROVIDER=apify. An unset/empty DSN is
 * Sentry's own documented way to disable the SDK
 * (https://docs.sentry.io/platforms/javascript/guides/nextjs/), so
 * nothing here changes behavior for a deployment that hasn't configured
 * an account — see docs/PRODUCTION_HARDENING.md.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // This app has no PII in error context by default; keep it that way.
  sendDefaultPii: false,
});
