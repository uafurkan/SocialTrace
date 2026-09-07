import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { createOrGetGoogleUser } from "@/lib/auth/users";
import { fetchGoogleAccount, GoogleAuthError } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session-cookie";
import { GOOGLE_OAUTH_STATE_COOKIE, CLEARED_GOOGLE_OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/auth/google-state-cookie";

/**
 * Redirects to /login with an error message rather than returning a raw
 * JSON error — unlike the JSON auth routes, this endpoint is only ever
 * reached by the browser's own top-level navigation coming back from
 * Google, so a page is the right response, not an API error body.
 */
function loginError(request: NextRequest, message: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", CLEARED_GOOGLE_OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return loginError(request, "Accounts require a configured database.");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (searchParams.get("error")) {
    return loginError(request, "Google login was cancelled.");
  }
  if (!code || !rawState || !cookieState) {
    return loginError(request, "Google login failed. Please try again.");
  }

  const [state, encodedNext] = rawState.split(":");
  if (state !== cookieState) {
    return loginError(request, "Google login failed. Please try again.");
  }
  const next = encodedNext ? decodeURIComponent(encodedNext) : "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  try {
    const { googleId, email } = await fetchGoogleAccount(code);
    const user = await createOrGetGoogleUser(googleId, email);
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.redirect(new URL(safeNext, request.url));
    response.cookies.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", CLEARED_GOOGLE_OAUTH_STATE_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return loginError(request, error.message);
    }
    throw error;
  }
}
