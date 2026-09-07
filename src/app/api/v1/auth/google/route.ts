import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { buildGoogleAuthUrl, isGoogleLoginConfigured } from "@/lib/auth/google";
import { GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/auth/google-state-cookie";

/**
 * Starts the redirect-based OAuth flow: a random `state` value is stored
 * in a short-lived httpOnly cookie and echoed back by Google on the
 * callback — the callback route rejects anything that doesn't match,
 * which is what stops an attacker from forging a callback request (CSRF
 * on the login itself). `next` lets the login/signup pages send the user
 * back to wherever they started (defaults to /account).
 */
export function GET(request: NextRequest) {
  if (!isGoogleLoginConfigured()) {
    return NextResponse.json({ error: "Google login is not configured." }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/account";
  // Only ever a same-site relative path — never forward an absolute/external URL through this param.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildGoogleAuthUrl(`${state}:${encodeURIComponent(safeNext)}`));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, GOOGLE_OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
