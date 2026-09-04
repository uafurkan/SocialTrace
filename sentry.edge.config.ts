import * as Sentry from "@sentry/nextjs";

// Same as sentry.server.config.ts, for the Edge runtime (middleware.ts,
// any edge-runtime route). See that file's comment for why an unset DSN
// is safe.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
