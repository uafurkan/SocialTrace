"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

/**
 * Profile-segment error boundary. The root boundary (src/app/error.tsx) says
 * "Something went wrong — this page ran into an unexpected error", which is
 * the wrong story here: by far the most common failure under /profile is that
 * an upstream data source is temporarily unreachable (an exhausted provider
 * quota, an actor outage). That is expected, transient, and recovers on its
 * own — telling the visitor it was unexpected invites them to give up, and
 * `notFound()` would be worse still by implying the profile doesn't exist.
 *
 * A profile whose data we have ever successfully fetched doesn't reach this
 * boundary at all: getCachedProfile serves the last known good copy instead
 * (src/lib/cache/profile-cache.ts). So this page is specifically the
 * "never fetched, and can't fetch right now" case.
 */
export default function ProfileSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">This profile&apos;s data isn&apos;t available right now</h1>
      <p className="mt-2 text-secondary">
        We couldn&apos;t reach the data source for this profile. This is usually temporary — try again in a few minutes.
        Profiles that have been loaded before will still show their most recent saved snapshot.
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
