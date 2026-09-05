import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isPaddleConfigured, paddleFetch } from "@/lib/billing/paddle";

interface PaddleSubscription {
  data: {
    management_urls: { update_payment_method: string | null; cancel: string | null } | null;
  };
}

/**
 * Paddle has no single Stripe-style "customer portal" URL — self-service
 * links are per-subscription deep links returned on the subscription
 * resource itself (`management_urls.update_payment_method`/`.cancel`,
 * confirmed against Paddle's subscription API reference). This route
 * looks up the account's current subscription and hands both back so
 * `<ManageBillingButton>` can offer "update payment method" and "cancel"
 * separately (docs/BILLING.md).
 */
export async function GET(request: NextRequest) {
  if (!isPaddleConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ paddleSubscriptionId: schema.users.paddleSubscriptionId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!row?.paddleSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found." }, { status: 404 });
  }

  try {
    const subscription = await paddleFetch<PaddleSubscription>(`/subscriptions/${row.paddleSubscriptionId}`);
    return NextResponse.json({
      updatePaymentMethodUrl: subscription.data.management_urls?.update_payment_method ?? null,
      cancelUrl: subscription.data.management_urls?.cancel ?? null,
    });
  } catch (error) {
    console.error("Paddle subscription lookup failed:", error);
    return NextResponse.json({ error: "Couldn't load billing details right now." }, { status: 502 });
  }
}
