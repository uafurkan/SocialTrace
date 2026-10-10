import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAIN_DEADLINE_MS,
  ColdBudgetExceededError,
  chargeColdStart,
  createIpColdBudget,
  DeadlineExceededError,
  MEMBER_ROUTE_MAX_DURATION_S,
  MIN_RUN_WAIT_MS,
  ROUTE_HEADROOM_MS,
  runWithColdBudget,
  withDeadline,
} from "./cold-budget";
import { withDataCache } from "./data-cache";

const MEMBER_ROUTES = [
  "src/app/api/v1/profiles/[profileId]/followers/route.ts",
  "src/app/api/v1/profiles/[profileId]/following/route.ts",
  "src/app/api/v1/tiktok/profiles/[profileId]/followers/route.ts",
  "src/app/api/v1/tiktok/profiles/[profileId]/following/route.ts",
];

describe("member route budget", () => {
  it("keeps the chain budget plus the headroom at the route limit, which is at most 60 s", () => {
    expect(MEMBER_ROUTE_MAX_DURATION_S).toBeLessThanOrEqual(60);
    expect(CHAIN_DEADLINE_MS + ROUTE_HEADROOM_MS).toBe(MEMBER_ROUTE_MAX_DURATION_S * 1000);
    expect(MIN_RUN_WAIT_MS).toBeLessThan(CHAIN_DEADLINE_MS);
  });

  it.each(MEMBER_ROUTES)("%s exports the same maxDuration as the budget", (file) => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const source = readFileSync(path.join(repoRoot, file), "utf8");
    const match = /^export const maxDuration = (\d+);/m.exec(source);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MEMBER_ROUTE_MAX_DURATION_S);
  });
});

// In-memory stand-in for the provider_cache table, so withDataCache runs its real
// hit, miss and stale paths without a database.
const db = vi.hoisted(() => ({
  configured: true,
  rows: new Map<string, { cacheKey: string; data: unknown; fetchedAt: Date }>(),
}));

vi.mock("@/lib/db", () => ({
  isDbConfigured: () => db.configured,
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

/** A budget for `ip` whose charge calls are recorded. It is not in scope until passed to runWithColdBudget. */
function budgetFor(ip: string) {
  const budget = createIpColdBudget(ip);
  return { budget, charge: vi.spyOn(budget, "charge") };
}

describe("cold budget", () => {
  beforeEach(() => {
    db.configured = true;
    db.rows.clear();
  });

  describe("createIpColdBudget", () => {
    it("allows 6 cold starts per address, then refuses with a Retry-After", async () => {
      const budget = createIpColdBudget("198.51.100.50");
      for (let i = 0; i < 6; i++) {
        expect(await budget.charge()).toBe(true);
      }
      expect(await budget.charge()).toBe(false);
      expect(budget.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("keeps each address's budget separate", async () => {
      const first = createIpColdBudget("198.51.100.51");
      for (let i = 0; i < 6; i++) {
        await first.charge();
      }
      expect(await first.charge()).toBe(false);
      expect(await createIpColdBudget("198.51.100.52").charge()).toBe(true);
    });
  });

  describe("chargeColdStart", () => {
    it("is a no-op outside a budget context, even when a budget that exists would refuse", async () => {
      const { charge } = budgetFor("198.51.100.64");
      charge.mockResolvedValue(false);
      await expect(chargeColdStart()).resolves.toBeUndefined();
      expect(charge).not.toHaveBeenCalled();
    });

    it("throws ColdBudgetExceededError inside a context whose budget is spent", async () => {
      const budget = createIpColdBudget("198.51.100.53");
      for (let i = 0; i < 6; i++) {
        await budget.charge();
      }
      const error = await runWithColdBudget(budget, () => chargeColdStart()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ColdBudgetExceededError);
      expect((error as ColdBudgetExceededError).retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("withDataCache", () => {
    it("charges one cold start on a miss and none on a fresh hit", async () => {
      const { budget, charge } = budgetFor("198.51.100.60");
      const fetchFn = vi.fn(async () => ["alice"]);

      const first = await runWithColdBudget(budget, () => withDataCache("members:followers:a", fetchFn));
      const second = await runWithColdBudget(budget, () => withDataCache("members:followers:a", fetchFn));

      expect(first).toEqual(["alice"]);
      expect(second).toEqual(["alice"]);
      expect(charge).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("refuses a miss once the budget is spent, without running the fetch or serving a stale row", async () => {
      // A stale row for the key would be served if the refusal were treated as a source failure.
      const staleKey = "members:following:stale";
      db.rows.set(staleKey, {
        cacheKey: staleKey,
        data: ["old"],
        fetchedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      });
      const budget = createIpColdBudget("198.51.100.61");
      for (let i = 0; i < 6; i++) {
        await runWithColdBudget(budget, () => withDataCache(`members:followers:x${i}`, async () => []));
      }

      const fetchFn = vi.fn(async () => ["new"]);
      const error = await runWithColdBudget(budget, () => withDataCache(staleKey, fetchFn)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ColdBudgetExceededError);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("charges every call when no database is configured, since nothing is cached", async () => {
      db.configured = false;
      const { budget, charge } = budgetFor("198.51.100.62");
      const fetchFn = vi.fn(async () => []);

      await runWithColdBudget(budget, () => withDataCache("members:followers:y", fetchFn));
      await runWithColdBudget(budget, () => withDataCache("members:followers:y", fetchFn));

      expect(charge).toHaveBeenCalledTimes(2);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("does not charge when no budget is in scope", async () => {
      const { charge } = budgetFor("198.51.100.63");
      const fetchFn = vi.fn(async () => ["x"]);

      await expect(withDataCache("members:followers:z", fetchFn)).resolves.toEqual(["x"]);
      expect(charge).not.toHaveBeenCalled();
    });
  });

  describe("withDeadline", () => {
    it("resolves with the value when the work settles in time", async () => {
      await expect(withDeadline(Promise.resolve("done"), 45_000)).resolves.toBe("done");
    });

    it("rejects with DeadlineExceededError when the work is still pending at the limit", async () => {
      vi.useFakeTimers();
      try {
        const pending = withDeadline(new Promise<never>(() => {}), 45_000);
        const assertion = expect(pending).rejects.toBeInstanceOf(DeadlineExceededError);
        await vi.advanceTimersByTimeAsync(45_000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
