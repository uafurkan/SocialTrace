/**
 * The anonymous visitor id backing the watchlist (src/lib/db/schema.ts's
 * watchlistEntries, docs/TRACKING.md) — a first-party cookie, not an
 * account, since this build has no auth. Kept in one place so the cookie
 * name/options can't drift between the routes that read and write it.
 */
export const VISITOR_COOKIE = "st_visitor";

export const VISITOR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
