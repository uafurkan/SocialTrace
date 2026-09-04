import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { runScheduledCapture } from "@/lib/snapshot/scheduled-capture";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron target (see vercel.json) — the only "scheduler" this build
 * has (docs/KNOWN_LIMITATIONS.md's missing background-worker piece).
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
 * invocations when CRON_SECRET is set
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs);
 * without that secret configured, this route refuses to run at all rather
 * than being an open door that anyone could hit to force (potentially
 * billed, see docs/PROVIDER_CONTRACT.md) provider calls.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured; refusing to run." }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "No database configured; nothing to capture." }, { status: 501 });
  }

  const result = await runScheduledCapture();
  return NextResponse.json(result);
}
