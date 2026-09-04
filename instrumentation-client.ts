import * as Sentry from "@sentry/nextjs";

// Browser-side counterpart to sentry.server.config.ts/sentry.edge.config.ts.
// Needs NEXT_PUBLIC_SENTRY_DSN (not SENTRY_DSN) since only NEXT_PUBLIC_*
// env vars are embedded in the client bundle. Same unset-is-disabled
// behavior — see docs/PRODUCTION_HARDENING.md.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
