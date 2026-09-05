import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getProPriceId, isPaddleConfigured, paddleFetch } from "@/lib/billing/paddle";

interface PaddleCustomer {
  data: { id: string };
}

interface PaddleTransaction {
  data: { id: string };
}

/**
 * Creates a Paddle customer (reused across attempts) and a transaction for
 * the Pro price, then hands the client just the transaction id —
 * `<CheckoutButton>` opens Paddle.js's checkout overlay for that
 * transaction (`Paddle.Checkout.open({ transactionId })`) rather than
 * this route returning a redirect URL. Paddle Billing's checkout is
 * JS-based (unlike Stripe's fully-hosted Checkout page), so the overlay
 * is the standard integration, not a workaround (docs/BILLING.md).
 * Requires a logged-in account: an anonymous visitor has no `users` row
 * to attach a subscription to.
 */
export async function POST(request: NextRequest) {
  if (!isPaddleConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to upgrade." }, { status: 401 });
  }

  const db = getDb();

  const [existing] = await db
    .select({ paddleCustomerId: schema.users.paddleCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  // Reuse the customer created on a previous (possibly abandoned) checkout
  // attempt rather than creating a new Paddle customer every time this
  // route is hit.
  let customerId = existing?.paddleCustomerId ?? null;
  if (!customerId) {
    const customer = await paddleFetch<PaddleCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({ email: user.email, custom_data: { userId: user.id } }),
    });
    customerId = customer.data.id;
    await db.update(schema.users).set({ paddleCustomerId: customerId }).where(eq(schema.users.id, user.id));
  }

  try {
    const transaction = await paddleFetch<PaddleTransaction>("/transactions", {
      method: "POST",
      body: JSON.stringify({
        items: [{ price_id: getProPriceId(), quantity: 1 }],
        customer_id: customerId,
        custom_data: { userId: user.id },
      }),
    });

    return NextResponse.json({ transactionId: transaction.data.id });
  } catch (error) {
    console.error("Paddle transaction creation failed:", error);
    return NextResponse.json({ error: "Couldn't start checkout. Try again shortly." }, { status: 502 });
  }
}
