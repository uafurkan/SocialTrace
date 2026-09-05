import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { EmailAlreadyRegisteredError, createUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session-cookie";
import { signupSchema } from "@/lib/auth/validation";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Accounts require a configured database (DATABASE_URL is not set)." }, { status: 501 });
  }

  const rate = await rateLimit(`signup:${clientIdentifierFor(request)}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken, clientIdentifierFor(request));
  if (!turnstileOk) {
    return NextResponse.json({ error: "Bot verification failed. Please try again." }, { status: 403 });
  }

  try {
    const user = await createUser(parsed.data.email, parsed.data.password);
    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
    return response;
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
