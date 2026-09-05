import { sql } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { captureSnapshot } from "@/lib/snapshot/capture";
import { ProfileNotFoundError } from "@/lib/providers";

/**
 * There is no job queue (docs/KNOWN_LIMITATIONS.md), so "automatic"
 * snapshot capture for tracked profiles/saved searches means: an external
 * scheduler (Vercel Cron, see vercel.json and
 * src/app/api/cron/capture-tracked/route.ts) hits one route on an
 * interval, and this function captures a bounded batch of the profiles
 * that need it — bounded because each capture is a real, potentially
 * billed provider call (docs/PROVIDER_CONTRACT.md's Apify integration)
 * and a serverless function has a hard execution time limit.
 */
export const SCHEDULED_CAPTURE_BATCH_LIMIT = 25;

/**
 * Usernames the automatic capture cron must never touch, regardless of
 * whether they end up tracked/saved by a user — even if that means an
 * otherwise-eligible profile just never gets an automatic snapshot.
 */
const CAPTURE_EXCLUDED_USERNAMES = new Set(["uafurkn", "oilive.co"]);

export interface ScheduledCaptureResult {
  attempted: string[];
  succeeded: string[];
  failed: Array<{ username: string; error: string }>;
}

/**
 * Every profile with at least one tracker or saved search — the set
 * "automatic capture" exists to serve. `savedSearches` is read with a raw
 * `db.execute(sql\`...\`)` rather than the query builder's `.select().
 * innerJoin()`: confirmed live that the builder form silently returns
 * zero rows against `saved_searches inner join profiles` on this
 * drizzle-orm/neon-http combination even though `.toSQL()` reports the
 * exact same SQL text a raw `execute()` of that text answers correctly —
 * a genuine builder bug, not a data or logic issue (isolated by testing
 * a brand-new client, queried first, with nothing else in the request).
 * `watchlistEntries`'s equivalent join isn't affected, but both use the
 * same raw form here for one proven-correct code path instead of one
 * "works today" and one "works around a specific bug."
 */
async function listProfilesNeedingCapture(limit: number): Promise<string[]> {
  const db = getDb();
  const [trackedResult, searchedResult] = await Promise.all([
    db.execute(sql`select p.username from watchlist_entries w inner join profiles p on w.profile_id = p.id`),
    db.execute(sql`select p.username from saved_searches s inner join profiles p on s.profile_id = p.id`),
  ]);

  const usernames = new Set<string>();
  for (const row of trackedResult.rows as Array<{ username: string }>) usernames.add(row.username);
  for (const row of searchedResult.rows as Array<{ username: string }>) usernames.add(row.username);
  for (const excluded of usernames) {
    if (CAPTURE_EXCLUDED_USERNAMES.has(excluded.toLowerCase())) usernames.delete(excluded);
  }
  return [...usernames].slice(0, limit);
}

/**
 * Captures a bounded batch of profiles sequentially (not in parallel) —
 * deliberately, since a real provider hitting Apify concurrently for many
 * profiles risks hitting rate limits/costs faster than a fixed schedule
 * intends. One profile's failure (deleted/private/renamed account,
 * provider error) doesn't stop the batch; it's recorded and skipped.
 */
export async function runScheduledCapture(limit = SCHEDULED_CAPTURE_BATCH_LIMIT): Promise<ScheduledCaptureResult> {
  const usernames = await listProfilesNeedingCapture(limit);
  const result: ScheduledCaptureResult = { attempted: usernames, succeeded: [], failed: [] };

  for (const username of usernames) {
    try {
      await captureSnapshot(username);
      result.succeeded.push(username);
    } catch (error) {
      const message = error instanceof ProfileNotFoundError ? "Profile not found" : error instanceof Error ? error.message : "Unknown error";
      result.failed.push({ username, error: message });
    }
  }

  return result;
}
