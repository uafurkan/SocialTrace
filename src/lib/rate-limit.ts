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

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
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

function rateLimitInProcess(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
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
  if (!redis) return rateLimitInProcess(key, limit, windowMs);

  const result = await getUpstashLimiter(redis, limit, windowMs).limit(key);
  return {
    allowed: result.success,
    retryAfterSeconds: result.success ? 0 : Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

export function clientIdentifierFor(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
