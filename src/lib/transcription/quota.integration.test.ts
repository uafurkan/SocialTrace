import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { isDbConfigured, getDb, schema } from "@/lib/db";
import { PLAN_LIMITS, PlanLimitError } from "@/lib/billing/plans";
import { uniqueUsername } from "@/lib/db/test-helpers";
import {
  ANONYMOUS_DAILY_LIMIT,
  assertTranscriptionAllowed,
  recordUsage,
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
      /anonymous usage is limited/i,
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
