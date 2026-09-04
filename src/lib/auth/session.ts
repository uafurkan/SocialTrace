import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb, schema } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./session-cookie";

export interface SessionUser {
  id: string;
  email: string;
  plan: "free" | "pro";
}

/**
 * The raw token is what's set in the cookie; only its SHA-256 hash is ever
 * written to the database (see the `sessions` table comment in
 * src/lib/db/schema.ts) — a leaked database row alone can't be replayed
 * as a valid session cookie.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
}

export async function getSessionUserByToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      plan: schema.users.plan,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!row || row.expiresAt <= new Date()) return null;
  return { id: row.userId, email: row.email, plan: row.plan };
}

export function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  return getSessionUserByToken(request.cookies.get(SESSION_COOKIE)?.value);
}
