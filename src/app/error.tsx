"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

/**
 * Root-segment error boundary (Next.js App Router convention) — catches
 * an unhandled exception anywhere under this segment (e.g. a provider
 * throwing something other than ProfileNotFoundError, or a DB call
 * failing when DATABASE_URL is misconfigured) and shows a real page
 * instead of the framework's default crash screen. Doesn't cover errors
 * thrown by the root layout itself — see global-error.tsx for that.
 */
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Something went wrong</h1>
      <p className="mt-2 text-secondary">
        This page ran into an unexpected error. It&apos;s been logged — try again, or head back home.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="tertiary">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
