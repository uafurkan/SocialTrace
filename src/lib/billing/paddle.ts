import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Thin fetch wrapper around Paddle's REST API — same "no SDK needed for one
 * vendor's REST endpoint" pattern as src/lib/providers/apify/client.ts,
 * rather than pulling in a server-side Paddle SDK for what's a handful of
 * calls (create customer, create transaction, read a subscription). The
 * one real SDK dependency this app has (@paddle/paddle-js) is client-side
 * only, for the checkout overlay — see src/components/billing/checkout-button.tsx.
 *
 * PADDLE_ENVIRONMENT selects sandbox vs production, mirroring the
 * dashboard toggle — sandbox is the default so a misconfigured deploy
 * can't accidentally hit the live API.
 */
const PADDLE_API_BASE = process.env.PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

export function isPaddleConfigured(): boolean {
  return Boolean(process.env.PADDLE_API_KEY);
}

export async function paddleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not set. See .env.example / docs/BILLING.md.");
  }

  const response = await fetch(`${PADDLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Paddle API ${init?.method ?? "GET"} ${path} failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

/** The one recurring price this app sells — see docs/BILLING.md for setup. */
export function getProPriceId(): string {
  const priceId = process.env.PADDLE_PRO_PRICE_ID;
  if (!priceId) {
    throw new Error("PADDLE_PRO_PRICE_ID is not set. See .env.example / docs/BILLING.md.");
  }
  return priceId;
}

/**
 * Verifies a Paddle webhook's `Paddle-Signature` header
 * (`ts=<unix seconds>;h1=<hex hmac>`) against the raw request body —
 * confirmed against Paddle's own webhook signature docs: the signed
 * payload is `${ts}:${rawBody}`, HMAC-SHA256'd with the notification
 * destination's signing secret. Uses a timing-safe comparison and rejects
 * a timestamp older than 5 minutes to bound replay risk (Paddle's own
 * docs suggest a much tighter window for the happy path, but webhook
 * delivery can legitimately retry after a delay, so this errs less
 * aggressively than Paddle's own example).
 */
export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(";").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.ts;
  const receivedSignature = parts.h1;
  if (!timestamp || !receivedSignature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expectedSignature = createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(receivedSignature, "hex");
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}
