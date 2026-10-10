import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Real distributed rate limiting when Upstash Redis is configured
 * (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN), falling back to the
 * original in-process fixed-window counter otherwise — the same
 * mock-provider-style "opt-in real integration, honest default" pattern
 * as SOCIAL_PROVIDER=apify (docs/PROVIDER_CONTRACT.md). Unconfigured,
 * this behaves exactly as before: real protection for a single
 * long-lived process, not for a multi-instance serverless deployment
 * (docs/PRODUCTION_HARDENING.md). Configured, every call site gets real
 * cross-instance protection with no call-site changes beyond `await`.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const upstashLimiters = new Map<string, Ratelimit>();

/** Size at which expired in-process buckets are swept. Exported for tests. */
export const BUCKET_SWEEP_THRESHOLD = 5_000;
let nextSweepAt = BUCKET_SWEEP_THRESHOLD;

// One client per process, created on first use. `null` means Upstash is not
// configured; `undefined` means the environment has not been read yet.
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redisClient = url && token ? new Redis({ url, token }) : null;
  }
  return redisClient;
}

/** Lazily created once per (limit, window) pair actually used, not once per call — the Ratelimit object is just config, but there's no reason to rebuild it every request. */
function getUpstashLimiter(redis: Redis, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const existing = upstashLimiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.ceil(windowMs / 1000))} s`),
    prefix: "socialtrace",
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Removes expired buckets once the map reaches the sweep threshold. The next
 * threshold is twice the surviving size, so a map that is mostly live keys is
 * not rescanned on every call (amortized constant work per request).
 */
function sweepExpiredBuckets(now: number): void {
  if (buckets.size < nextSweepAt) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  nextSweepAt = Math.max(BUCKET_SWEEP_THRESHOLD, buckets.size * 2);
}

/** Number of in-process buckets currently held. Exported for tests. */
export function inProcessBucketCount(): number {
  return buckets.size;
}

function rateLimitInProcess(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      const result = await getUpstashLimiter(redis, limit, windowMs).limit(key);
      return {
        allowed: result.success,
        retryAfterSeconds: result.success ? 0 : Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch (error) {
      // Use the in-process counter for this call instead of failing the
      // request: a Redis outage should not turn every rate-limited route into a 500.
      console.warn("[rate-limit] Upstash call failed; using the in-process counter for this request:", error);
    }
  }
  return rateLimitInProcess(key, limit, windowMs);
}

/**
 * Client address for rate-limit keys: the first `x-forwarded-for` entry.
 * If the platform appends its own address after a client-sent value, that
 * first entry can be spoofed, and a client can rotate it to get a fresh
 * bucket. Before relying on this, verify on a preview deployment: send a
 * spoofed `x-forwarded-for` and check which address the limiter sees.
 */
export function clientIdentifierFor(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
