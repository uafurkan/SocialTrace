import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { isDbConfigured, getDb, schema } from "@/lib/db";
import { PLAN_LIMITS, PlanLimitError } from "@/lib/billing/plans";
import { uniqueUsername } from "@/lib/db/test-helpers";
import {
  ANONYMOUS_DAILY_LIMIT,
  PENDING_RESERVATION_WINDOW_MS,
  assertTranscriptionAllowed,
  deleteUsageReservation,
  recordUsage,
  reserveGlobalSlot,
  utcDayKey,
} from "./quota";

/**
 * `transcription_usage` rows are what the daily transcriber quota (per
 * scope) and the global billed ceiling both count against — this exercises
 * the counting itself against the real DB (no Apify/Groq calls, so it's
 * fast and free) rather than trusting the SQL by inspection alone.
 */
describe.skipIf(!isDbConfigured())("transcription quota (integration)", () => {
  const scopeIds: string[] = [];

  afterAll(async () => {
    if (scopeIds.length === 0) return;
    const db = getDb();
    for (const scopeId of scopeIds) {
      await db
        .delete(schema.transcriptionUsage)
        .where(eq(schema.transcriptionUsage.scopeId, scopeId));
    }
  });

  it("allows an anonymous scope up to ANONYMOUS_DAILY_LIMIT, then throws", async () => {
    const scopeId = uniqueUsername("quota-anon");
    scopeIds.push(scopeId);

    for (let i = 0; i < ANONYMOUS_DAILY_LIMIT; i++) {
      await assertTranscriptionAllowed(scopeId, null);
      await recordUsage(scopeId, uniqueUsername("cachekey"), false);
    }

    await expect(assertTranscriptionAllowed(scopeId, null)).rejects.toThrow(
      `Free usage is limited to ${ANONYMOUS_DAILY_LIMIT} transcriptions per day. Try again tomorrow.`,
    );
  });

  it("enforces the free plan's daily transcription limit", async () => {
    const scopeId = uniqueUsername("quota-free");
    scopeIds.push(scopeId);
    const limit = PLAN_LIMITS.free.maxTranscriptionsPerDay;

    for (let i = 0; i < limit; i++) {
      await assertTranscriptionAllowed(scopeId, "free");
      await recordUsage(scopeId, uniqueUsername("cachekey"), false);
    }

    await expect(
      assertTranscriptionAllowed(scopeId, "free"),
    ).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("scopes the count per visitor — one scope's usage never counts against another's", async () => {
    const scopeA = uniqueUsername("quota-a");
    const scopeB = uniqueUsername("quota-b");
    scopeIds.push(scopeA, scopeB);

    for (let i = 0; i < ANONYMOUS_DAILY_LIMIT; i++) {
      await recordUsage(scopeA, uniqueUsername("k"), false);
    }
    await expect(assertTranscriptionAllowed(scopeA, null)).rejects.toThrow();
    await expect(
      assertTranscriptionAllowed(scopeB, null),
    ).resolves.toBeUndefined();
  });

  it("a Pro account gets a strictly higher ceiling than free", async () => {
    const scopeId = uniqueUsername("quota-pro");
    scopeIds.push(scopeId);
    const freeLimit = PLAN_LIMITS.free.maxTranscriptionsPerDay;

    for (let i = 0; i < freeLimit; i++) {
      await recordUsage(scopeId, uniqueUsername("k"), false);
    }
    // A free account would already be over its own limit at this count...
    await expect(
      assertTranscriptionAllowed(scopeId, "free"),
    ).rejects.toBeInstanceOf(PlanLimitError);
    // ...but the same usage count is still fine for Pro (100/day).
    await expect(
      assertTranscriptionAllowed(scopeId, "pro"),
    ).resolves.toBeUndefined();
  });
});

/**
 * The global ceiling is a counter row per UTC day (`transcription_daily_budget`).
 * Each test here reserves on its own day far in the future (2099 and later),
 * passed as `now`, so its counter row is shared with no real request and no
 * other test. The rows are removed afterwards.
 */
describe.skipIf(!isDbConfigured())("global transcription ceiling (integration)", () => {
  const RUN_BASE_DAY = Math.floor(Math.random() * 3000);
  const DAY_MS = 24 * 60 * 60 * 1000;
  let testIndex = 0;
  const dayKeys: string[] = [];
  const scopeIds: string[] = [];
  const cacheKeys: string[] = [];

  /** A fresh noon UTC instant on an otherwise unused day. */
  function freshNow(): Date {
    testIndex += 1;
    const now = new Date(Date.UTC(2099, 0, 1, 12) + (RUN_BASE_DAY + testIndex) * DAY_MS);
    dayKeys.push(utcDayKey(now));
    return now;
  }

  afterAll(async () => {
    const db = getDb();
    if (scopeIds.length > 0) {
      await db.delete(schema.transcriptionUsage).where(inArray(schema.transcriptionUsage.scopeId, scopeIds));
    }
    if (cacheKeys.length > 0) {
      await db.delete(schema.transcriptCache).where(inArray(schema.transcriptCache.cacheKey, cacheKeys));
    }
    if (dayKeys.length > 0) {
      await db.delete(schema.transcriptionDailyBudget).where(inArray(schema.transcriptionDailyBudget.day, dayKeys));
    }
  });

  it("never grants more than the ceiling under concurrent reservations (20 parallel, ceiling 3, exactly 3 succeed)", async () => {
    const now = freshNow();
    const scopeId = uniqueUsername("ceiling-race");
    scopeIds.push(scopeId);

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => reserveGlobalSlot(scopeId, uniqueUsername(`race-${i}`), 3, now)),
    );

    expect(results.filter((id) => id !== null)).toHaveLength(3);
    const [budget] = await getDb()
      .select()
      .from(schema.transcriptionDailyBudget)
      .where(eq(schema.transcriptionDailyBudget.day, utcDayKey(now)));
    expect(budget.used).toBe(3);
  });

  it("gives a failed reservation's slot back to the next request", async () => {
    const now = freshNow();
    const scopeId = uniqueUsername("ceiling-release");
    scopeIds.push(scopeId);

    const first = await reserveGlobalSlot(scopeId, uniqueUsername("a"), 2, now);
    const second = await reserveGlobalSlot(scopeId, uniqueUsername("b"), 2, now);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(await reserveGlobalSlot(scopeId, uniqueUsername("c"), 2, now)).toBeNull();

    await deleteUsageReservation(first as string);

    expect(await reserveGlobalSlot(scopeId, uniqueUsername("d"), 2, now)).not.toBeNull();
    expect(await reserveGlobalSlot(scopeId, uniqueUsername("e"), 2, now)).toBeNull();
  });

  it("reclaims a reservation abandoned past the pending window, so its slot frees up", async () => {
    const start = freshNow();
    const later = new Date(start.getTime() + PENDING_RESERVATION_WINDOW_MS + 60 * 1000);
    const scopeId = uniqueUsername("ceiling-expiry");
    scopeIds.push(scopeId);
    const abandonedKey = uniqueUsername("abandoned");
    cacheKeys.push(abandonedKey);
    // The run that made this reservation died, so its transcript stays `processing`.
    await getDb().insert(schema.transcriptCache).values({
      cacheKey: abandonedKey,
      platform: "youtube",
      sourceUrl: `https://example.com/${abandonedKey}`,
    });

    expect(await reserveGlobalSlot(scopeId, abandonedKey, 1, start)).not.toBeNull();
    // Inside the window the abandoned reservation still holds the only slot.
    expect(await reserveGlobalSlot(scopeId, uniqueUsername("inside"), 1, start)).toBeNull();
    // Past the window it is reclaimed, and the slot is free again.
    expect(await reserveGlobalSlot(scopeId, uniqueUsername("after"), 1, later)).not.toBeNull();
  });
});
