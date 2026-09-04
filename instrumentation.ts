/**
 * Next.js's instrumentation hook (stable since 14.x, no experimental flag
 * needed) — the one place server/edge Sentry init can run before any
 * route handler does, per Sentry's Next.js App Router integration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
