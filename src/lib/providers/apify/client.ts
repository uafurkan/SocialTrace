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

/** Runs an Apify actor synchronously and returns its dataset items (raw, unnormalized). */
export async function runApifyActor(actorId: string, input: Record<string, unknown>): Promise<unknown> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not set — required when SOCIAL_PROVIDER=apify.");
  }

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

function isErrorBody(body: unknown): body is { error: { message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object"
  );
}
