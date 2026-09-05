import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { planForSubscriptionStatus } from "@/lib/billing/webhook-handlers";

/**
 * The only path that ever sets users.plan to "pro" — never trust a
 * client-side "I paid" signal, only a signature-verified event straight
 * from Stripe (docs/BILLING.md). Needs the raw request body (not parsed
 * JSON) for stripe.webhooks.constructEvent's signature check, and must
 * run per-request (no caching) since it's driven entirely by external
 * events.
 */
export const dynamic = "force-dynamic";

async function setPlanByCustomerId(customerId: string, plan: "free" | "pro", subscriptionId: string | null) {
  const db = getDb();
  await db
    .update(schema.users)
    .set({ plan, stripeSubscriptionId: subscriptionId })
    .where(eq(schema.users.stripeCustomerId, customerId));
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
        if (customerId) {
          await setPlanByCustomerId(customerId, "pro", subscriptionId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const plan = event.type === "customer.subscription.deleted" ? "free" : planForSubscriptionStatus(subscription.status);
        await setPlanByCustomerId(customerId, plan, event.type === "customer.subscription.deleted" ? null : subscription.id);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
