import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { getSessionUserByToken, type SessionUser } from "./session";
import { SESSION_COOKIE } from "./session-cookie";
import { VISITOR_COOKIE } from "@/lib/tracking/visitor-cookie";

/**
 * Tracking and saved searches (docs/TRACKING.md, docs/SAVED_SEARCHES.md)
 * were built before accounts existed, scoped by an anonymous
 * `st_visitor` cookie stored in a plain `visitor_id` text column — both
 * docs explicitly noted the upgrade path: "swap the cookie value for a
 * users.id once accounts exist." This is that swap, done without any
 * schema change: a logged-in visitor's scope becomes `account:<userId>`
 * instead of the browser cookie, so their tracked profiles and saved
 * searches follow them across browsers/devices. An anonymous visitor
 * (no session) keeps the exact behavior from before accounts existed.
 */
export interface RequestIdentity {
  /** The string stored in watchlist_entries.visitor_id / saved_searches.visitor_id. */
  scopeId: string;
  /** Non-null only when the identity is a real account — gates plan limits (docs/BILLING.md). */
  account: SessionUser | null;
  /** Set only when an anonymous visitor had no cookie yet — the caller must set it on the response. */
  visitorCookieToIssue: string | null;
}

async function resolveIdentityCore(
  sessionToken: string | undefined,
  existingVisitorId: string | undefined,
): Promise<RequestIdentity> {
  const sessionUser = await getSessionUserByToken(sessionToken);
  if (sessionUser) {
    return { scopeId: `account:${sessionUser.id}`, account: sessionUser, visitorCookieToIssue: null };
  }

  if (existingVisitorId) {
    return { scopeId: existingVisitorId, account: null, visitorCookieToIssue: null };
  }

  const visitorId = randomUUID();
  return { scopeId: visitorId, account: null, visitorCookieToIssue: visitorId };
}

/** For Route Handlers, which read cookies off the request. */
export function resolveIdentity(request: NextRequest): Promise<RequestIdentity> {
  return resolveIdentityCore(request.cookies.get(SESSION_COOKIE)?.value, request.cookies.get(VISITOR_COOKIE)?.value);
}

/**
 * For Server Components (`next/headers` cookies() instead of a request) —
 * read-only, since a Server Component can't set a response cookie itself;
 * a fresh anonymous visitor id computed here is only used for that one
 * render (e.g. "you have 0 tracked profiles"), not persisted.
 */
export function resolveIdentityReadOnly(): Promise<RequestIdentity> {
  const store = cookies();
  return resolveIdentityCore(store.get(SESSION_COOKIE)?.value, store.get(VISITOR_COOKIE)?.value);
}
