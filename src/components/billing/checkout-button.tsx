"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shared shape for both billing buttons below: POST to a route that
 * returns a Stripe-hosted URL, then navigate the browser there directly —
 * no Stripe.js on our side (docs/BILLING.md).
 */
function useBillingRedirect(endpoint: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Try again shortly.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Try again shortly.");
      setLoading(false);
    }
  };

  return { start, loading, error };
}

export function UpgradeButton() {
  const { start, loading, error } = useBillingRedirect("/api/v1/billing/checkout");
  return (
    <div>
      <Button onClick={start} disabled={loading}>
        {loading ? "Redirecting…" : "Upgrade to Pro"}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const { start, loading, error } = useBillingRedirect("/api/v1/billing/portal");
  return (
    <div>
      <Button variant="secondary" onClick={start} disabled={loading}>
        {loading ? "Redirecting…" : "Manage billing"}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
