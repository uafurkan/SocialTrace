import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { isPaddleConfigured, verifyPaddleWebhookSignature } from "@/lib/billing/paddle";
import { planForSubscriptionStatus, type PaddleSubscriptionStatus } from "@/lib/billing/webhook-handlers";

/**
 * The only path that ever sets users.plan to "pro" — never trust a
 * client-side "I paid" signal, only a signature-verified event straight
 * from Paddle (docs/BILLING.md). Needs the raw request body (not parsed
 * JSON) for verifyPaddleWebhookSignature's HMAC check, and must run
 * per-request (no caching) since it's driven entirely by external events.
 */
export const dynamic = "force-dynamic";

interface PaddleWebhookEvent {
  event_type: string;
  data: {
    id: string;
    customer_id: string;
    status?: PaddleSubscriptionStatus;
  };
}

/**
 * `subscriptionId` is only passed (and written) by the subscription
 * events, which are authoritative for it — `transaction.completed` fires
 * around the same time as `subscription.created` with no reliable
 * ordering guarantee, so it only ever touches `plan` to avoid a race that
 * could null out a subscription id the other event just set.
 */
async function setPlanByCustomerId(customerId: string, plan: "free" | "pro", subscriptionId?: string | null) {
  const db = getDb();
  const values: Partial<typeof schema.users.$inferInsert> = { plan };
  if (subscriptionId !== undefined) values.paddleSubscriptionId = subscriptionId;
  await db.update(schema.users).set(values).where(eq(schema.users.paddleCustomerId, customerId));
}

export async function POST(request: NextRequest) {
  if (!isPaddleConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 501 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paddle-signature");
  if (!verifyPaddleWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    console.error("Paddle webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PaddleWebhookEvent;

  try {
    switch (event.event_type) {
      case "transaction.completed": {
        await setPlanByCustomerId(event.data.customer_id, "pro");
        break;
      }
      case "subscription.created":
      case "subscription.updated": {
        const plan = planForSubscriptionStatus(event.data.status ?? "canceled");
        await setPlanByCustomerId(event.data.customer_id, plan, event.data.id);
        break;
      }
      case "subscription.canceled": {
        await setPlanByCustomerId(event.data.customer_id, "free", null);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Paddle webhook handler failed for ${event.event_type}:`, error);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
