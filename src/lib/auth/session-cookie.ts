/**
 * Session cookie name/options in one place, same reason
 * src/lib/tracking/visitor-cookie.ts does it — so the routes that set and
 * read it can't drift.
 */
export const SESSION_COOKIE = "st_session";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS / 1000,
};

export const CLEARED_SESSION_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 0,
};
