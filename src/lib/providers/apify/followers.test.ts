import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHAIN_DEADLINE_MS, MIN_RUN_WAIT_MS } from "@/lib/cache/cold-budget";
import { APIFY_TIMEOUT_MS } from "./client";
import { fetchMembers, runMemberChain, type ActorRun } from "./followers";

const { runApifyActor, db } = vi.hoisted(() => ({
  runApifyActor: vi.fn(),
  db: { rows: new Map<string, { cacheKey: string; data: unknown; fetchedAt: Date }>() },
}));

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  runApifyActor,
}));

// The real data cache runs on an in-memory stand-in for provider_cache, so the
// "nothing is cached" checks see exactly what a write would have stored.
vi.mock("@/lib/db", () => ({
  isDbConfigured: () => true,
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (condition: { value: string }) => ({
          limit: async () => {
            const row = db.rows.get(condition.value);
            return row ? [row] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (row: { cacheKey: string; data: unknown; fetchedAt: Date }) => ({
        onConflictDoUpdate: async () => {
          db.rows.set(row.cacheKey, row);
        },
      }),
    }),
  }),
  schema: { providerCache: { cacheKey: "cacheKey" } },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));

// profile-cache.ts imports getProvider from the provider index; not needed here.
vi.mock("@/lib/providers", () => ({ getProvider: () => undefined }));

const usableItem = [{ userId: "1", username: "alice", fullName: "Alice", profilePicUrl: "", isVerified: false }];

/** A clock the test moves by hand, passed to runMemberChain as `now`. */
function fakeClock() {
  let at = 1_000_000;
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms;
    },
  };
}

/** The error an actor run raises when our timeout aborts its fetch. */
function abortError() {
  return Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
}

describe("fetchMembers (Instagram chain)", () => {
  beforeEach(() => {
    runApifyActor.mockReset();
    db.rows.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the first usable actor's list and starts no further actors", async () => {
    runApifyActor.mockResolvedValueOnce(usableItem);

    const members = await fetchMembers("someone", "followers", 60);

    expect(members.map((m) => m.username)).toEqual(["alice"]);
    expect(runApifyActor).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list, and caches it, when every actor finishes within the limit", async () => {
    runApifyActor.mockResolvedValue([]);

    await expect(fetchMembers("someone", "followers", 60)).resolves.toEqual([]);
    expect(runApifyActor).toHaveBeenCalledTimes(5);
    expect(db.rows.size).toBe(1);
  });

  it("starts no further actor after 45 s and throws, so an empty guess is not cached", async () => {
    // The first actor answers with nothing usable, but only after 46 s.
    runApifyActor.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 46_000);
      return [];
    });

    await expect(fetchMembers("someone", "followers", 60)).rejects.toThrow(/45s limit/);
    expect(runApifyActor).toHaveBeenCalledTimes(1);
    expect(db.rows.size).toBe(0);
  });

  it("a chain cut off by the budget with no data throws, caches nothing, and reruns on the next request", async () => {
    runApifyActor.mockImplementation(async (_actorId: string, _input: unknown, { timeoutMs }: { timeoutMs: number }) => {
      vi.setSystemTime(Date.now() + timeoutMs);
      throw abortError();
    });

    await expect(fetchMembers("someone", "followers", 60)).rejects.toThrow(/45s limit/);
    expect(db.rows.size).toBe(0);

    await expect(fetchMembers("someone", "followers", 60)).rejects.toThrow(/45s limit/);
    expect(runApifyActor).toHaveBeenCalledTimes(2);
  });
});

describe("runMemberChain (time budget)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([0, 5_000, 14_999, 15_000, 30_000, 44_999, 45_000, 60_000, 120_000])(
    "an actor answering after %i ms: the chain ends inside the budget and no wait exceeds the time left",
    async (answerMs) => {
      const clock = fakeClock();
      const start = clock.now();
      const waits: Array<{ timeoutMs: number; leftMs: number }> = [];
      const run = vi.fn<ActorRun>(async (_actorId, _input, { timeoutMs }) => {
        waits.push({ timeoutMs, leftMs: start + CHAIN_DEADLINE_MS - clock.now() });
        if (answerMs >= timeoutMs) {
          clock.advance(timeoutMs);
          throw abortError();
        }
        clock.advance(answerMs);
        return [];
      });

      await runMemberChain("someone", "followers", 60, { now: clock.now, run }).catch(() => undefined);

      expect(clock.now() - start).toBeLessThanOrEqual(CHAIN_DEADLINE_MS);
      for (const { timeoutMs, leftMs } of waits) {
        expect(timeoutMs).toBeLessThanOrEqual(APIFY_TIMEOUT_MS);
        expect(timeoutMs).toBeLessThanOrEqual(leftMs);
      }
    },
  );

  it("clamps the first wait to the budget when the actor timeout is longer", async () => {
    const clock = fakeClock();
    const run = vi.fn<ActorRun>(async () => {
      clock.advance(1);
      return [];
    });

    await runMemberChain("someone", "followers", 60, { now: clock.now, run });

    expect(run.mock.calls[0][2].timeoutMs).toBe(CHAIN_DEADLINE_MS);
  });

  it("starts no actor once the budget runs out, and throws so nothing is cached", async () => {
    const clock = fakeClock();
    const run = vi.fn<ActorRun>(async () => {
      clock.advance(40_000);
      return [];
    });

    await expect(runMemberChain("someone", "followers", 60, { now: clock.now, run })).rejects.toThrow(/45s limit/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("starts a run with exactly MIN_RUN_WAIT_MS left, and gives it only that much", async () => {
    const clock = fakeClock();
    const run = vi
      .fn<ActorRun>()
      .mockImplementationOnce(async () => {
        clock.advance(CHAIN_DEADLINE_MS - MIN_RUN_WAIT_MS);
        return [];
      })
      .mockImplementationOnce(async () => {
        clock.advance(1);
        return usableItem;
      });

    const members = await runMemberChain("someone", "followers", 60, { now: clock.now, run });

    expect(members.map((m) => m.username)).toEqual(["alice"]);
    expect(run.mock.calls[1][2].timeoutMs).toBe(MIN_RUN_WAIT_MS);
  });

  it("does not return an empty list when the last actor is cut off by the budget", async () => {
    const clock = fakeClock();
    let calls = 0;
    const run = vi.fn<ActorRun>(async (_actorId, _input, { timeoutMs }) => {
      calls++;
      if (calls <= 4) {
        clock.advance(7_500);
        return [];
      }
      // Four empty answers leave 15 s: the fifth actor is started with that and is cut off.
      clock.advance(timeoutMs);
      throw abortError();
    });

    await expect(runMemberChain("someone", "followers", 60, { now: clock.now, run })).rejects.toThrow(/45s limit/);
    expect(calls).toBe(5);
  });

  it("keeps an empty answer that came in time, since every actor answered", async () => {
    const clock = fakeClock();
    const run = vi.fn<ActorRun>(async () => {
      clock.advance(1_000);
      return [];
    });

    await expect(runMemberChain("someone", "followers", 60, { now: clock.now, run })).resolves.toEqual([]);
    expect(run).toHaveBeenCalledTimes(5);
  });
});
