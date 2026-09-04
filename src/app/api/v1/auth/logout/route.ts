import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { invalidateSession } from "@/lib/auth/session";
import { CLEARED_SESSION_COOKIE_OPTIONS, SESSION_COOKIE } from "@/lib/auth/session-cookie";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && isDbConfigured()) {
    await invalidateSession(token);
  }
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, "", CLEARED_SESSION_COOKIE_OPTIONS);
  return response;
}
