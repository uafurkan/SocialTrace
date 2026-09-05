import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

/**
 * Opens Stripe's hosted Billing Portal — cancel, change payment method,
 * view invoices — for an account that already has a Stripe customer (i.e.
 * has started or completed a checkout at least once). No portal
 * configuration is created here; that's a one-time dashboard setup step
 * (docs/BILLING.md).
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!row?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found yet — start a checkout first." }, { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${request.nextUrl.origin}/account`,
  });

  return NextResponse.json({ url: session.url });
}
