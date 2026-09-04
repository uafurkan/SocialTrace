import { NextRequest, NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ user: null });
  }
  const user = await getSessionUser(request);
  return NextResponse.json({ user });
}
