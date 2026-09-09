/**
 * Thin client for Bright Data's Datasets API v3 — the third link in the
 * profile source chain (free public endpoint → Apify → Bright Data → stale
 * cache), added because Apify's account has its own separate monthly quota
 * and Bright Data is a genuinely independent one (its own free 5,000
 * records/month, no shared billing relationship with Apify at all).
 *
 * Unlike Apify's run-sync-get-dataset-items (one call, blocks for the
 * actor's runtime), Bright Data's dataset scrape is trigger → poll progress
 * → fetch snapshot. Confirmed live: a single Instagram profile took ~50s
 * end to end (browser-based scrape, not an API lookup) — call sites budget
 * for this (profile pages already set `maxDuration = 60`; routes that add
 * this fallback do the same) and only reach this link after the free
 * source and Apify have both already failed, so the extra wait replaces an
 * error page rather than slowing down the common case.
 */

const BASE_URL = "https://api.brightdata.com";
const TRIGGER_URL = `${BASE_URL}/datasets/v3/trigger`;
const PROGRESS_URL = `${BASE_URL}/datasets/v3/progress`;
const SNAPSHOT_URL = `${BASE_URL}/datasets/v3/snapshot`;

const DEFAULT_POLL_INTERVAL_MS = 4_000;
const DEFAULT_MAX_WAIT_MS = 50_000;

export class BrightDataError extends Error {
  constructor(message: string) {
    super(`Bright Data: ${message}`);
    this.name = "BrightDataError";
  }
}

/**
 * `null` (not a throw) when the token isn't configured — this fallback link
 * is optional per-deployment, same as any other "this source can't answer"
 * case in the chain, not a hard failure.
 */
function bearerToken(): string | null {
  return process.env.BRIGHTDATA_API_TOKEN || null;
}

export function isBrightDataConfigured(): boolean {
  return bearerToken() !== null;
}

interface TriggerResponse {
  snapshot_id?: string;
}

interface ProgressResponse {
  status?: string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/**
 * Starts a dataset collection and returns immediately with a snapshot_id —
 * does not wait for it to finish. Live testing found completion time wildly
 * variable and often far past what any page load can wait for (Instagram
 * ~50s on one run but not ready at all within 50s on another; Facebook
 * ~66s; TikTok still not ready past 150s) — so nothing in this codebase
 * blocks on this call. See `pollBrightDataSnapshot` for the background half.
 */
export async function triggerBrightDataDataset(
  datasetId: string,
  payload: Array<Record<string, unknown>>,
): Promise<string> {
  const token = bearerToken();
  if (!token) throw new BrightDataError("BRIGHTDATA_API_TOKEN is not configured");

  const triggerRes = await fetch(`${TRIGGER_URL}?dataset_id=${datasetId}&include_errors=true`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!triggerRes.ok) {
    throw new BrightDataError(`trigger failed (HTTP ${triggerRes.status}): ${await triggerRes.text()}`);
  }
  const { snapshot_id: snapshotId } = (await triggerRes.json()) as TriggerResponse;
  if (!snapshotId) throw new BrightDataError("trigger response had no snapshot_id");
  return snapshotId;
}

/**
 * Polls an already-triggered snapshot until it's ready (or fails / times
 * out) and returns its records. Meant to run in the background, after the
 * request that triggered it has already responded — see
 * `src/app/profile/**\/page.tsx`'s use of `after()` and
 * `providers/brightdata/profile.ts`.
 */
export async function pollBrightDataSnapshot(
  snapshotId: string,
  options: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<unknown[]> {
  const token = bearerToken();
  if (!token) throw new BrightDataError("BRIGHTDATA_API_TOKEN is not configured");

  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const headers = authHeaders(token);

  const startedAt = Date.now();
  while (true) {
    const progressRes = await fetch(`${PROGRESS_URL}/${snapshotId}`, { headers });
    const progress = progressRes.ok ? ((await progressRes.json()) as ProgressResponse) : { status: "error" };

    if (progress.status === "ready") break;
    if (progress.status === "failed" || progress.status === "error") {
      throw new BrightDataError(`snapshot ${snapshotId} failed (status: ${progress.status})`);
    }
    if (Date.now() - startedAt > maxWaitMs) {
      throw new BrightDataError(`snapshot ${snapshotId} not ready after ${maxWaitMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const snapshotRes = await fetch(`${SNAPSHOT_URL}/${snapshotId}?format=json`, { headers });
  if (!snapshotRes.ok) {
    throw new BrightDataError(`snapshot fetch failed (HTTP ${snapshotRes.status}): ${await snapshotRes.text()}`);
  }
  const data = (await snapshotRes.json()) as unknown;
  return Array.isArray(data) ? data : [];
}
