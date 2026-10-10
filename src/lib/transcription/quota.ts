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

/** UTC calendar day of `now`, as the `YYYY-MM-DD` key of `transcription_daily_budget`. */
export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
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
 * Whether a usage row takes a slot under the global ceiling today. The counter
 * in `transcription_daily_budget` is maintained to match this definition (see
 * the "Global slot counter" note further down).
 *
 * - Rows from before today's UTC midnight never count.
 * - Billed rows always count.
 * - An unbilled row is a pending reservation only while its transcript is
 *   still `processing` and the row is inside the pending window. Cache hits
 *   and requests that waited on someone else's run are unbilled too, but
 *   their transcript is `done`, so they never take a slot.
 *
 * `countOccupiedToday` expresses this rule in SQL (see `occupiedTodaySql`).
 * Keep the two in step.
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
 * The reservation id from the rows a reserve statement returned. The statement
 * returns no row when it took no slot, so no row means the ceiling was full.
 */
export function reservationIdFromRows(rows: ReadonlyArray<unknown>): string | null {
  const row = rows[0] as { id?: unknown } | undefined;
  return typeof row?.id === "string" ? row.id : null;
}

/**
 * SQL form of `occupiesGlobalCeiling` for rows aliased `u` (transcription_usage).
 * Used by the read-only pre-check. It is the exact count the counter must match.
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

/*
 * Global slot counter (finding A8).
 *
 * `transcription_daily_budget.used` for a UTC day equals the number of usage
 * rows that day which hold a slot: reservations taken by `reserveGlobalSlot`,
 * owner rows written by `recordUsage` while their transcript is still
 * `processing` (admin runs, which skip the refusal but still occupy), and
 * rows written already billed. A slot is given back in the same statement that
 * deletes its row: a failed reservation (`deleteUsageReservation`) or an
 * abandoned one past the pending window (`reclaimExpiredReservations`).
 * Billing a row changes nothing, because a billed row keeps its slot.
 *
 * Every change to the counter is one statement with the matching row change,
 * so the counter cannot drift from the rows. The ceiling check is an upsert
 * on one row, which takes that row's lock and re-reads the latest committed
 * value. That is what makes the bound strict under READ COMMITTED. A count
 * followed by an insert cannot be made strict this way, because the count's
 * snapshot is fixed when the statement starts.
 */

/**
 * Gives back the slots of reservations abandoned by a run that died before it
 * could release or bill them, such as a function killed at maxDuration. These
 * are the rows the window rule in `occupiesGlobalCeiling` stops counting:
 * unbilled, older than the pending window, and still `processing`. Each row is
 * deleted and its slot returned in one statement, so no slot is returned twice.
 */
async function reclaimExpiredReservations(now: Date): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    WITH expired AS (
      DELETE FROM transcription_usage u
      WHERE u.billed = false
        AND u.created_at >= ${utcMidnight(now).toISOString()}::timestamptz
        AND u.created_at < ${pendingReservationCutoff(now).toISOString()}::timestamptz
        AND EXISTS (
          SELECT 1 FROM transcript_cache c
          WHERE c.cache_key = u.cache_key AND c.status = 'processing'
        )
      RETURNING u.id
    )
    UPDATE transcription_daily_budget
    SET used = GREATEST(used - (SELECT count(*)::int FROM expired), 0)
    WHERE day = ${utcDayKey(now)}::date
      AND EXISTS (SELECT 1 FROM expired)`);
}

/**
 * Claims one global slot for a pipeline run and records its reservation. The
 * slot and the usage row are written by one statement: an upsert that adds 1
 * to today's counter only while it is below `ceiling`, and inserts the usage
 * row only when that upsert succeeded. Returns the reservation id, or null
 * when the ceiling is already full (nothing is written in that case).
 *
 * Abandoned reservations past the pending window are released first, so the
 * decision matches `occupiesGlobalCeiling`.
 */
export async function reserveGlobalSlot(
  scopeId: string,
  cacheKey: string,
  ceiling: number = GLOBAL_DAILY_BILLED_CEILING,
  now: Date = new Date(),
): Promise<string | null> {
  if (ceiling < 1) return null;
  await reclaimExpiredReservations(now);

  const db = getDb();
  const result = await db.execute(sql`
    WITH budget AS (
      INSERT INTO transcription_daily_budget (day, used)
      VALUES (${utcDayKey(now)}::date, 1)
      ON CONFLICT (day) DO UPDATE
        SET used = transcription_daily_budget.used + 1
        WHERE transcription_daily_budget.used < ${ceiling}::int
      RETURNING used
    )
    INSERT INTO transcription_usage (scope_id, cache_key, billed, created_at)
    SELECT ${scopeId}::text, ${cacheKey}::text, false, ${now.toISOString()}::timestamptz
    FROM budget
    RETURNING id`);
  return reservationIdFromRows(result.rows);
}

/**
 * Returns the new row's id so a reservation made before a pipeline run (see the
 * transcribe route) can later be updated to `billed: true` or deleted on failure.
 * A row that holds a slot (billed at insert, or an owner row whose transcript is
 * still `processing`) bumps the day's counter in the same statement, so it is
 * released like any reservation. A cache hit or a request that waited on another
 * run is unbilled with a `done` transcript, so it never holds a slot.
 */
export async function recordUsage(scopeId: string, cacheKey: string, billed: boolean): Promise<string> {
  const db = getDb();
  const now = new Date();
  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO transcription_usage (scope_id, cache_key, billed, created_at)
      VALUES (${scopeId}::text, ${cacheKey}::text, ${billed}::boolean, ${now.toISOString()}::timestamptz)
      RETURNING id
    ), counted AS (
      INSERT INTO transcription_daily_budget (day, used)
      SELECT ${utcDayKey(now)}::date, 1
      FROM inserted
      WHERE ${billed}::boolean OR EXISTS (
        SELECT 1 FROM transcript_cache c
        WHERE c.cache_key = ${cacheKey}::text AND c.status = 'processing'
      )
      ON CONFLICT (day) DO UPDATE SET used = transcription_daily_budget.used + 1
      RETURNING used
    )
    SELECT id FROM inserted`);
  const row = result.rows[0] as { id: string };
  return row.id;
}

/** Flips a usage reservation to billed once the pipeline run it was reserved for actually completes and produces a real (non-cache-hit) result. */
export async function markUsageBilled(usageId: string): Promise<void> {
  const db = getDb();
  await db.update(schema.transcriptionUsage).set({ billed: true }).where(eq(schema.transcriptionUsage.id, usageId));
}

/**
 * Releases a usage reservation whose pipeline run failed before billing — a
 * failed attempt shouldn't cost the visitor part of their daily quota. The row
 * is deleted and its slot returned in one statement. A billed row is never
 * deleted here, and a row that was already reclaimed is a no-op, so a slot is
 * never returned twice.
 */
export async function deleteUsageReservation(usageId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    WITH released AS (
      DELETE FROM transcription_usage
      WHERE id = ${usageId}::uuid AND billed = false
      RETURNING created_at
    )
    UPDATE transcription_daily_budget b
    SET used = GREATEST(b.used - 1, 0)
    FROM released r
    WHERE b.day = (r.created_at AT TIME ZONE 'UTC')::date`);
}
