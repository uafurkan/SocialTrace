/**
 * Per-address budget for cold member-list lookups, and the time limits that
 * bound one cold provider chain (plan B1, B2, B12).
 *
 * A follower or following list costs real money only when it has to be
 * fetched. The data cache serves every later page of the same list for free,
 * so the budget is charged inside `withDataCache`, on a miss, once per cold
 * chain start. Cached paging never reaches the charge.
 *
 * A route opts in by running its provider call inside `runWithColdBudget`.
 * Outside such a context (server components, scripts) `chargeColdStart` does
 * nothing, so those callers behave exactly as before.
 *
 * AsyncLocalStorage needs the Node.js runtime. Every route that uses this
 * module runs there: none exports `runtime = "edge"`, and the default is
 * `nodejs` (Next.js route-segment config, runtime.md).
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { rateLimit } from "@/lib/rate-limit";

/** Cold member lists one address may start per window. */
export const COLD_MEMBERS_LIMIT = 6;
export const COLD_MEMBERS_WINDOW_MS = 10 * 60 * 1000;

/**
 * Time limit for one provider chain or one side of a comparison. Past it, a
 * chain starts no further actor runs (plan B2), and a route stops waiting
 * (plan B12). A run already in flight is not cancelled.
 */
export const CHAIN_DEADLINE_MS = 45_000;

export interface ColdBudget {
  /** Charges one cold chain start. Resolves false when the budget is spent. */
  charge(): Promise<boolean>;
  /** Seconds until a charge can succeed again. Meaningful after `charge()` returned false. */
  readonly retryAfterSeconds: number;
}

export class ColdBudgetExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Cold lookup budget exceeded for this address.");
    this.name = "ColdBudgetExceededError";
  }
}

export class DeadlineExceededError extends Error {
  constructor(public readonly deadlineMs: number) {
    super(`Timed out after ${deadlineMs} ms.`);
    this.name = "DeadlineExceededError";
  }
}

const storage = new AsyncLocalStorage<ColdBudget>();

/**
 * Budget for one request, keyed by client address. Every member-list route
 * shares the key, so a visitor cannot get a fresh allowance by switching
 * between followers and following, or between Instagram and TikTok.
 */
export function createIpColdBudget(ip: string): ColdBudget {
  let retryAfterSeconds = 0;
  return {
    async charge() {
      const result = await rateLimit(`cold-members:${ip}`, COLD_MEMBERS_LIMIT, COLD_MEMBERS_WINDOW_MS);
      retryAfterSeconds = result.retryAfterSeconds;
      return result.allowed;
    },
    get retryAfterSeconds() {
      return retryAfterSeconds;
    },
  };
}

/** Runs `fn` with `budget` in scope for everything it awaits. */
export function runWithColdBudget<T>(budget: ColdBudget, fn: () => Promise<T>): Promise<T> {
  return storage.run(budget, fn);
}

/**
 * Called by the data cache on a miss, before the provider fetch runs. Throws
 * ColdBudgetExceededError when the budget in scope is spent. Does nothing when
 * no budget is in scope.
 */
export async function chargeColdStart(): Promise<void> {
  const budget = storage.getStore();
  if (!budget) return;
  if (!(await budget.charge())) {
    throw new ColdBudgetExceededError(Math.max(1, budget.retryAfterSeconds));
  }
}

/**
 * Rejects with DeadlineExceededError if `promise` has not settled within `ms`.
 * The underlying work keeps running; only the wait is abandoned.
 */
export async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineExceededError(ms)), ms);
  });
  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}
