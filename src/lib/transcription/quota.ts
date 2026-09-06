import { and, count, eq, gte } from "drizzle-orm";

import { assertWithinLimit, type Plan } from "@/lib/billing/plans";
import { getDb, schema } from "@/lib/db";

/** Anonymous visitors have no plan (docs/BILLING.md never limits them), but an uncapped transcriber is a real, unbounded bill — see plans.ts. */
export const ANONYMOUS_DAILY_LIMIT = 3;

/**
 * Global safety net (docs/TRANSCRIBER.md bad-outcome #9): once this many
 * *billed* (non-cache-hit) transcriptions have run today, new uncached
 * requests are refused site-wide until UTC midnight — an honest "high
 * demand today" beats a silent bill overrun. Cache hits never count
 * against this, so a viral cached link stays free to re-view.
 */
export const GLOBAL_DAILY_BILLED_CEILING = 300;

function utcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function countUsageSince(where: ReturnType<typeof and>): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(schema.transcriptionUsage).where(where);
  return row.value;
}

/** Throws `PlanLimitError` (account) or a plain honest `Error` (anonymous cap / global ceiling) — the API route maps both to a 429 with the message as-is. */
export async function assertTranscriptionAllowed(scopeId: string, plan: Plan | null): Promise<void> {
  const since = utcMidnight();

  const scopeCount = await countUsageSince(and(eq(schema.transcriptionUsage.scopeId, scopeId), gte(schema.transcriptionUsage.createdAt, since)));
  if (plan) {
    assertWithinLimit(plan, "transcriptions per day", scopeCount);
  } else if (scopeCount >= ANONYMOUS_DAILY_LIMIT) {
    throw new Error(`Free anonymous usage is limited to ${ANONYMOUS_DAILY_LIMIT} transcriptions per day. Sign up for a free account for a higher limit.`);
  }

  const billedToday = await countUsageSince(and(eq(schema.transcriptionUsage.billed, true), gte(schema.transcriptionUsage.createdAt, since)));
  if (billedToday >= GLOBAL_DAILY_BILLED_CEILING) {
    throw new Error("We've hit today's transcription capacity. Please try again after midnight UTC.");
  }
}

export async function recordUsage(scopeId: string, cacheKey: string, billed: boolean): Promise<void> {
  const db = getDb();
  await db.insert(schema.transcriptionUsage).values({ scopeId, cacheKey, billed });
}
