/**
 * Thin wrapper around Apify's REST API. One endpoint does everything this
 * provider needs (run an actor synchronously, get its dataset items back
 * in the response body), so no SDK dependency — see docs/PROVIDER_CONTRACT.md.
 */
/** How long one actor call may wait when the caller does not say otherwise. */
export const APIFY_TIMEOUT_MS = 60_000;

export interface ActorRunOptions {
  /**
   * Longest this call may wait, counted from its start. The wait covers the
   * run-slot queue, any concurrency retries and the HTTP request together.
   * Defaults to APIFY_TIMEOUT_MS.
   */
  timeoutMs?: number;
}

export class ApifyActorError extends Error {
  constructor(
    public readonly actorId: string,
    message: string,
  ) {
    super(`Apify actor "${actorId}" failed: ${message}`);
    this.name = "ApifyActorError";
  }
}

// The Apify account has a plan-level cap on concurrent actor runs. Several
// tabs/visitors hitting different actors at once routinely exceeds it — this
// is a transient resource conflict, not a real failure, so it's worth a
// couple of short retries instead of failing the whole page immediately.
const CONCURRENCY_LIMIT_RETRY_DELAYS_MS = [2_000, 4_000];

function isConcurrencyLimitError(message: string): boolean {
  return message.includes("concurrent Actor runs");
}

/**
 * An exhausted Apify plan ("Monthly usage hard limit exceeded") is an
 * account-level condition, not a per-actor one: every actor fails, instantly
 * and identically, until the quota resets or is raised.
 */
export function isApifyQuotaError(error: unknown): boolean {
  if (!(error instanceof ApifyActorError)) return false;
  const message = error.message.toLowerCase();
  return message.includes("usage hard limit") || message.includes("monthly usage");
}

/**
 * Circuit breaker for that account-level condition. Without it, the cost is
 * paid per request and multiplied by every fallback chain: the follower path
 * tries five actors in sequence, so an exhausted account means five
 * guaranteed-failing round-trips before the caller sees the same failure it
 * was always going to get. Latency, not correctness, is the damage.
 *
 * Once tripped, `runApifyActor` fails fast without issuing a request, letting
 * callers fall through to their free source or last-known-good cache
 * immediately. The window is short and self-healing: a restored quota
 * recovers on its own with no deploy or manual reset.
 */
const QUOTA_BREAKER_WINDOW_MS = 15 * 60 * 1000;
let quotaExhaustedUntil = 0;

function isQuotaBreakerOpen(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

function tripQuotaBreaker(): void {
  quotaExhaustedUntil = Date.now() + QUOTA_BREAKER_WINDOW_MS;
  console.error(
    `[apify] account usage limit hit — skipping all actor calls for ${QUOTA_BREAKER_WINDOW_MS / 60_000} minutes`,
  );
}

/** Test seam: lets the quota breaker be reset between cases instead of leaking state across tests. */
export function resetApifyQuotaBreaker(): void {
  quotaExhaustedUntil = 0;
}

/** Read-only breaker state for the diagnostics probe (src/app/api/v1/diagnostics/sources/route.ts) — never triggers a call. */
export function isApifyQuotaBreakerOpen(): boolean {
  return isQuotaBreakerOpen();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A per-instance semaphore on top of the per-call retry above. The retry
// alone still lets this instance fire N actor calls at once and race each
// other for Apify's account-wide concurrent-run cap; queuing here instead
// keeps this instance's own usage under the cap so it stops contributing to
// the failure it's also retrying around. Not a true global limit (each
// serverless instance has its own counter), but Vercel routes bursts to the
// same warm instance often enough for this to meaningfully help, and it's
// strictly better than no gate — see docs/DECISIONS.md.
const MAX_CONCURRENT_ACTOR_RUNS = 4;
let inFlightActorRuns = 0;
const actorRunQueue: Array<() => void> = [];

/**
 * Takes a run slot, waiting at most `timeoutMs`. A waiter that gives up leaves
 * the queue, so it never takes a slot it will not use.
 */
function acquireActorRunSlot(actorId: string, timeoutMs: number): Promise<void> {
  if (inFlightActorRuns < MAX_CONCURRENT_ACTOR_RUNS) {
    inFlightActorRuns++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const grant = () => {
      clearTimeout(timer);
      inFlightActorRuns++;
      resolve();
    };
    const timer = setTimeout(() => {
      const index = actorRunQueue.indexOf(grant);
      if (index !== -1) actorRunQueue.splice(index, 1);
      reject(new ApifyActorError(actorId, "timed out waiting for a free run slot"));
    }, Math.max(0, timeoutMs));
    actorRunQueue.push(grant);
  });
}

function releaseActorRunSlot(): void {
  inFlightActorRuns--;
  const next = actorRunQueue.shift();
  if (next) next();
}

type ActorRunStatus = "ok" | "error" | "timeout";

/** Our own timeout abort rejects the fetch with an AbortError. */
function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

async function runApifyActorOnce(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutMs: number,
): Promise<unknown> {
  // Token goes in the Authorization header, not the query string: URLs turn up
  // in logs and error reports, headers don't.
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const body: unknown = await res.json();
    if (!res.ok) {
      const message = isErrorBody(body) ? body.error.message : res.statusText;
      throw new ApifyActorError(actorId, message);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs an Apify actor synchronously and returns its dataset items (raw, unnormalized).
 *
 * `options.timeoutMs` bounds the whole call from its start: the wait for a run
 * slot, any concurrency retries and the HTTP request. Past it the call rejects.
 *
 * Stopping the wait does not stop the Apify run. The run keeps going on Apify's
 * side and is billed until it finishes. This wrapper reads only the dataset
 * items from run-sync-get-dataset-items, so it never learns the run id and has
 * nothing to abort. We do not try to cancel runs.
 */
export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  options: ActorRunOptions = {},
): Promise<unknown> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not set — required when SOCIAL_PROVIDER=apify.");
  }

  // Fail fast while the account is known to be out of quota. The thrown error
  // is the same shape callers already handle, so nothing downstream needs to
  // learn about the breaker — it just arrives sooner and for free.
  if (isQuotaBreakerOpen()) {
    throw new ApifyActorError(actorId, "Monthly usage hard limit exceeded (cached — not retried)");
  }

  const timeoutMs = options.timeoutMs ?? APIFY_TIMEOUT_MS;
  const deadlineAt = Date.now() + timeoutMs;
  await acquireActorRunSlot(actorId, timeoutMs);
  // Granted too late to start a run within the wait: give the slot back, and
  // throw before the try below so no run line is logged for a run never started.
  if (Date.now() >= deadlineAt) {
    releaseActorRunSlot();
    throw new ApifyActorError(actorId, "timed out waiting for a free run slot");
  }
  const startedAt = Date.now();
  let status: ActorRunStatus = "ok";
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const body = await runApifyActorOnce(actorId, input, token, deadlineAt - Date.now());
        status = "ok";
        return body;
      } catch (error) {
        status = isAbortError(error) ? "timeout" : "error";
        if (isApifyQuotaError(error)) {
          tripQuotaBreaker();
          throw error;
        }
        const canRetry = attempt < CONCURRENCY_LIMIT_RETRY_DELAYS_MS.length;
        if (!canRetry || !(error instanceof ApifyActorError) || !isConcurrencyLimitError(error.message)) {
          throw error;
        }
        const delayMs = CONCURRENCY_LIMIT_RETRY_DELAYS_MS[attempt];
        // A retry that cannot finish inside the caller's wait is not started.
        if (deadlineAt - Date.now() <= delayMs) {
          throw error;
        }
        await sleep(delayMs);
      }
    }
  } finally {
    releaseActorRunSlot();
    // One line per run, after retries: the actor run counter used to size Apify spend.
    console.log(`[apify-run] ${JSON.stringify({ actorId, durationMs: Date.now() - startedAt, status })}`);
  }
}

function isErrorBody(body: unknown): body is { error: { message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object"
  );
}
