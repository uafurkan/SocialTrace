import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import {
  AlreadyVerifiedError,
  InvalidCodeError,
  TooManyAttemptsError,
  verifyEmailCode,
} from "@/lib/auth/email-verification";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";

const VERIFY_RATE_LIMIT = 10;
const VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Accounts require a configured database (DATABASE_URL is not set)." }, { status: 501 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const rate = await rateLimit(`verify-email:${clientIdentifierFor(request)}`, VERIFY_RATE_LIMIT, VERIFY_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    await verifyEmailCode(user.id, code);
    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof AlreadyVerifiedError) {
      return NextResponse.json({ verified: true });
    }
    if (error instanceof TooManyAttemptsError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof InvalidCodeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
