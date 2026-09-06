import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { AlreadyVerifiedError, VerificationCooldownError, issueVerificationCode } from "@/lib/auth/email-verification";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

const RESEND_RATE_LIMIT = 5;
const RESEND_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Accounts require a configured database (DATABASE_URL is not set)." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const rate = await rateLimit(`resend-verification:${clientIdentifierFor(request)}`, RESEND_RATE_LIMIT, RESEND_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    await issueVerificationCode(user.id, user.email);
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof AlreadyVerifiedError) {
      return NextResponse.json({ verified: true });
    }
    if (error instanceof VerificationCooldownError) {
      return NextResponse.json(
        { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    console.error("[resend-verification] failed to send:", error);
    return NextResponse.json({ error: "Couldn't send the email right now. Please try again shortly." }, { status: 502 });
  }
}
