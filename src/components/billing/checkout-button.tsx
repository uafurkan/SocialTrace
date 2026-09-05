"use client";

import { useState } from "react";
import type { Paddle } from "@paddle/paddle-js";

import { Button } from "@/components/ui/button";

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const PADDLE_ENVIRONMENT = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

let paddleInstance: Paddle | undefined;
let paddleLoading: Promise<Paddle | undefined> | null = null;

/**
 * Paddle Billing's checkout is JS-based (an overlay iframe opened by
 * Paddle.js), not a fully-hosted redirect page like Stripe Checkout — so
 * unlike the earlier Stripe integration, this app does load a
 * client-side library here. Lazily imported (not a top-level import) so
 * it's never pulled into the bundle for visitors who never open this
 * button, and initialized once and reused across multiple clicks in the
 * same session.
 */
async function getPaddleInstance(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;
  if (!paddleLoading) {
    paddleLoading = import("@paddle/paddle-js").then(({ initializePaddle }) =>
      initializePaddle({ environment: PADDLE_ENVIRONMENT, token: PADDLE_CLIENT_TOKEN! }),
    );
  }
  paddleInstance = await paddleLoading;
  return paddleInstance;
}

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const [paddle, res] = await Promise.all([getPaddleInstance(), fetch("/api/v1/billing/checkout", { method: "POST" })]);
      const data = (await res.json()) as { transactionId?: string; error?: string };
      if (!res.ok || !data.transactionId || !paddle) {
        setError(data.error ?? "Something went wrong. Try again shortly.");
        setLoading(false);
        return;
      }
      paddle.Checkout.open({ transactionId: data.transactionId });
      setLoading(false);
    } catch {
      setError("Something went wrong. Try again shortly.");
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={start} disabled={loading || !PADDLE_CLIENT_TOKEN}>
        {loading ? "Loading…" : "Upgrade to Pro"}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ updatePaymentMethodUrl: string | null; cancelUrl: string | null } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/portal");
      const data = (await res.json()) as {
        updatePaymentMethodUrl?: string | null;
        cancelUrl?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again shortly.");
        setLoading(false);
        return;
      }
      setUrls({ updatePaymentMethodUrl: data.updatePaymentMethodUrl ?? null, cancelUrl: data.cancelUrl ?? null });
      setLoading(false);
    } catch {
      setError("Something went wrong. Try again shortly.");
      setLoading(false);
    }
  };

  if (urls) {
    return (
      <div className="flex flex-wrap gap-3">
        {urls.updatePaymentMethodUrl ? (
          <Button variant="secondary" asChild>
            <a href={urls.updatePaymentMethodUrl}>Update payment method</a>
          </Button>
        ) : null}
        {urls.cancelUrl ? (
          <Button variant="tertiary" asChild>
            <a href={urls.cancelUrl}>Cancel subscription</a>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Button variant="secondary" onClick={load} disabled={loading}>
        {loading ? "Loading…" : "Manage billing"}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
