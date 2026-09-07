/** Short-lived CSRF-state cookie for the Google OAuth redirect round-trip (src/app/api/v1/auth/google/route.ts + .../callback/route.ts) — same naming convention as session-cookie.ts. */
export const GOOGLE_OAUTH_STATE_COOKIE = "st_google_state";

export const GOOGLE_OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 10 * 60, // the whole consent round-trip should take seconds, not minutes
};

export const CLEARED_GOOGLE_OAUTH_STATE_COOKIE_OPTIONS = {
  ...GOOGLE_OAUTH_STATE_COOKIE_OPTIONS,
  maxAge: 0,
};
