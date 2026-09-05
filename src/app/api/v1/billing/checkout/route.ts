import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getProPriceId, getStripe, isStripeConfigured } from "@/lib/billing/stripe";

/**
 * Starts a Stripe-hosted Checkout session for the Pro subscription — no
 * Stripe.js/Elements on our side, the browser is just redirected to
 * checkout.stripe.com and back, so there's nothing to wire into the CSP
 * (docs/BILLING.md). Requires a logged-in account: an anonymous visitor
 * has no `users` row to attach a subscription to.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to upgrade." }, { status: 401 });
  }

  const db = getDb();
  const stripe = getStripe();
  const origin = request.nextUrl.origin;

  const [existing] = await db
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  // Reuse the customer created on a previous (possibly abandoned) checkout
  // attempt rather than creating a new Stripe customer every time this
  // route is hit.
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await db.update(schema.users).set({ stripeCustomerId: customerId }).where(eq(schema.users.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: getProPriceId(), quantity: 1 }],
    success_url: `${origin}/account?upgraded=1`,
    cancel_url: `${origin}/account`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Couldn't start checkout. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
