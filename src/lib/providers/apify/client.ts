/**
 * Thin wrapper around Apify's REST API. One endpoint does everything this
 * provider needs (run an actor synchronously, get its dataset items back
 * in the response body), so no SDK dependency — see docs/PROVIDER_CONTRACT.md.
 */
const APIFY_TIMEOUT_MS = 60_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runApifyActorOnce(actorId: string, input: Record<string, unknown>, token: string): Promise<unknown> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

/** Runs an Apify actor synchronously and returns its dataset items (raw, unnormalized). */
export async function runApifyActor(actorId: string, input: Record<string, unknown>): Promise<unknown> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not set — required when SOCIAL_PROVIDER=apify.");
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await runApifyActorOnce(actorId, input, token);
    } catch (error) {
      const canRetry = attempt < CONCURRENCY_LIMIT_RETRY_DELAYS_MS.length;
      if (!canRetry || !(error instanceof ApifyActorError) || !isConcurrencyLimitError(error.message)) {
        throw error;
      }
      await sleep(CONCURRENCY_LIMIT_RETRY_DELAYS_MS[attempt]);
    }
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
