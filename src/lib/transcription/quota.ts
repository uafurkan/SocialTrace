import { and, count, eq, gte, sql } from "drizzle-orm";

import { assertWithinLimit, type Plan } from "@/lib/billing/plans";
import { getDb, schema } from "@/lib/db";

/** Anonymous visitors have no plan (docs/BILLING.md never limits them), but an uncapped transcriber is a real, unbounded bill — see plans.ts. */
export const ANONYMOUS_DAILY_LIMIT = 3;

/**
 * Global safety net (docs/TRANSCRIBER.md bad-outcome #9): once this many
 * pipeline runs are billed or still in flight today, new uncached requests
 * are refused site-wide until UTC midnight — an honest "high demand today"
 * beats a silent bill overrun. Cache hits never count against this, so a
 * viral cached link stays free to re-view.
 */
export const GLOBAL_DAILY_BILLED_CEILING = 300;

/**
 * How long an unbilled pipeline reservation keeps holding a slot under the
 * global ceiling. A live run is capped by the route's maxDuration (120s), so
 * anything older has either finished without being marked billed or was
 * abandoned by a function that died. It must stop holding capacity.
 */
export const PENDING_RESERVATION_WINDOW_MS = 5 * 60 * 1000;

export const GLOBAL_CEILING_MESSAGE = "We've hit today's transcription capacity. Please try again after midnight UTC.";

/**
 * Thrown for the anonymous cap and the global ceiling. The route answers
 * these (and PlanLimitError) with a 429 and the message as-is. Any other
 * error is internal and must not reach the client.
 */
export class TranscriptionQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptionQuotaError";
  }
}

/** Start of the UTC day containing `now` — the window every daily count uses. */
function utcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Oldest `createdAt` an unbilled reservation may have and still count as pending. */
export function pendingReservationCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_RESERVATION_WINDOW_MS);
}

/** A usage row, reduced to what the global ceiling needs in order to decide. */
export interface UsageForCeiling {
  billed: boolean;
  createdAt: Date;
  /** `status` of the transcript_cache row with the same cacheKey, or null when there is none. */
  transcriptStatus: string | null;
}

/**
 * Whether a usage row takes a slot under the global ceiling today.
 *
 * - Rows from before today's UTC midnight never count.
 * - Billed rows always count.
 * - An unbilled row is a pending reservation only while its transcript is
 *   still `processing` and the row is inside the pending window. Cache hits
 *   and requests that waited on someone else's run are unbilled too, but
 *   their transcript is `done`, so they never take a slot.
 *
 * `countOccupiedToday` and `reserveGlobalSlot` express this same rule in SQL
 * (see `occupiedTodaySql`). Keep the two in step.
 */
export function occupiesGlobalCeiling(row: UsageForCeiling, now: Date): boolean {
  const created = row.createdAt.getTime();
  if (created < utcMidnight(now).getTime()) return false;
  if (row.billed) return true;
  return row.transcriptStatus === "processing" && created >= pendingReservationCutoff(now).getTime();
}

/** Whether `occupied` slots leave room for one more pipeline run. */
export function hasGlobalCapacity(occupied: number, ceiling: number = GLOBAL_DAILY_BILLED_CEILING): boolean {
  return occupied < ceiling;
}

/**
 * Cost cap on one job's media length. An unknown length (0, negative, NaN,
 * infinite) counts as over the cap, so a missing duration cannot mean an
 * unbounded run. A real duration is over the cap only when strictly longer.
 */
export function exceedsDurationCap(durationSeconds: number, capSeconds: number): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return true;
  return durationSeconds > capSeconds;
}

/**
 * SQL form of `occupiesGlobalCeiling` for rows aliased `u` (transcription_usage).
 * Shared by the read-only pre-check and the reservation statement so both
 * apply exactly the same definition of "occupied".
 */
function occupiedTodaySql(now: Date) {
  return sql`u.created_at >= ${utcMidnight(now).toISOString()}::timestamptz
    AND (
      u.billed
      OR (
        u.created_at >= ${pendingReservationCutoff(now).toISOString()}::timestamptz
        AND EXISTS (
          SELECT 1 FROM transcript_cache c
          WHERE c.cache_key = u.cache_key AND c.status = 'processing'
        )
      )
    )`;
}

async function countOccupiedToday(now: Date): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT count(*)::int AS value FROM transcription_usage u WHERE ${occupiedTodaySql(now)}`,
  );
  const row = result.rows[0] as { value: number } | undefined;
  return row?.value ?? 0;
}

async function countUsageSince(where: ReturnType<typeof and>): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(schema.transcriptionUsage).where(where);
  return row.value;
}

/**
 * Throws `TranscriptionQuotaError` (anonymous cap, global ceiling) or
 * `PlanLimitError` (account). The API route maps both to a 429 with the
 * message as-is. This is a read-only pre-check, so it runs before any writes.
 * The authoritative global check happens in `reserveGlobalSlot`.
 */
export async function assertTranscriptionAllowed(scopeId: string, plan: Plan | null): Promise<void> {
  const now = new Date();
  const since = utcMidnight(now);

  const scopeCount = await countUsageSince(and(eq(schema.transcriptionUsage.scopeId, scopeId), gte(schema.transcriptionUsage.createdAt, since)));
  if (plan) {
    assertWithinLimit(plan, "transcriptions per day", scopeCount);
  } else if (scopeCount >= ANONYMOUS_DAILY_LIMIT) {
    throw new TranscriptionQuotaError(`Free usage is limited to ${ANONYMOUS_DAILY_LIMIT} transcriptions per day. Try again tomorrow.`);
  }

  if (!hasGlobalCapacity(await countOccupiedToday(now))) {
    throw new TranscriptionQuotaError(GLOBAL_CEILING_MESSAGE);
  }
}

/**
 * Claims one global slot for a pipeline run and records its reservation in a
 * single statement. The count and the insert happen together, so two
 * requests cannot each read "299 of 300" and both insert. Returns the new
 * reservation id, or null when the ceiling is already full.
 *
 * Limit: under Postgres READ COMMITTED each statement takes its snapshot when
 * it starts, so two concurrent statements can still both see 299 and both
 * insert. This narrows the race to one statement but does not fully close it.
 * A strict bound needs serialization: a single counter row updated with
 * `UPDATE ... WHERE used < ceiling RETURNING`, or a LOCK TABLE inside one
 * transaction (Neon HTTP batch), which needs a schema change or a new batch path.
 */
export async function reserveGlobalSlot(
  scopeId: string,
  cacheKey: string,
  ceiling: number = GLOBAL_DAILY_BILLED_CEILING,
  now: Date = new Date(),
): Promise<string | null> {
  const db = getDb();
  const result = await db.execute(sql`
    INSERT INTO transcription_usage (scope_id, cache_key, billed)
    SELECT ${scopeId}, ${cacheKey}, false
    WHERE (SELECT count(*) FROM transcription_usage u WHERE ${occupiedTodaySql(now)}) < ${ceiling}
    RETURNING id`);
  const row = result.rows[0] as { id: string } | undefined;
  return row?.id ?? null;
}

/** Returns the new row's id so a reservation made before a pipeline run (see the transcribe route) can later be updated to `billed: true` or deleted on failure. */
export async function recordUsage(scopeId: string, cacheKey: string, billed: boolean): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(schema.transcriptionUsage)
    .values({ scopeId, cacheKey, billed })
    .returning({ id: schema.transcriptionUsage.id });
  return row.id;
}

/** Flips a usage reservation to billed once the pipeline run it was reserved for actually completes and produces a real (non-cache-hit) result. */
export async function markUsageBilled(usageId: string): Promise<void> {
  const db = getDb();
  await db.update(schema.transcriptionUsage).set({ billed: true }).where(eq(schema.transcriptionUsage.id, usageId));
}

/** Releases a usage reservation whose pipeline run failed — a failed attempt shouldn't cost the visitor part of their daily quota. */
export async function deleteUsageReservation(usageId: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.transcriptionUsage).where(eq(schema.transcriptionUsage.id, usageId));
}
