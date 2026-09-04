/**
 * Fixed-window rate limiter, in-process memory only. This is real
 * protection for a single long-lived server process (this sandbox, a
 * self-hosted deployment via `next start`) but NOT for a multi-instance
 * serverless deployment (Vercel, etc.) — each function invocation can
 * land on a different instance with its own empty map, so a determined
 * caller can bypass it by fanning out. It's still worth having: it stops
 * the common case (a single client hammering one route) at zero
 * infrastructure cost, and gives every call site the same interface a
 * real distributed limiter (e.g. Upstash Redis) would need to replace it.
 * See docs/KNOWN_LIMITATIONS.md.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

export function clientIdentifierFor(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
