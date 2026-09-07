import { eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AccountUser {
  id: string;
  email: string;
  plan: "free" | "pro";
  emailVerified: boolean;
}

export async function createUser(email: string, password: string): Promise<AccountUser> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.normalizedEmail, normalizedEmail))
    .limit(1);
  if (existing) throw new EmailAlreadyRegisteredError();

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(schema.users)
    .values({ email: email.trim(), normalizedEmail, passwordHash })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      plan: schema.users.plan,
      emailVerified: schema.users.emailVerified,
    });
  return row;
}

export async function verifyCredentials(email: string, password: string): Promise<AccountUser> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);

  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      plan: schema.users.plan,
      emailVerified: schema.users.emailVerified,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.normalizedEmail, normalizedEmail))
    .limit(1);
  if (!row) throw new InvalidCredentialsError();

  // A Google-only account (see createOrGetGoogleUser below) has no
  // passwordHash — treat that as a wrong password rather than crashing
  // verifyPassword on a null hash, so those accounts simply can't be
  // logged into with this form (they always use "Continue with Google").
  if (!row.passwordHash) throw new InvalidCredentialsError();

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return { id: row.id, email: row.email, plan: row.plan, emailVerified: row.emailVerified };
}

/**
 * Finds the existing account for this Google identity, or creates one.
 * Matches on googleId first (returning user), then falls back to
 * normalizedEmail (a user who signed up with a password previously and
 * is now using "Continue with Google" for the first time — links the
 * Google identity onto their existing account instead of creating a
 * duplicate). A brand-new account gets emailVerified=true immediately:
 * Google already verified this address, so this project's own
 * email-verification-code flow (docs/AUTH.md) would be redundant here.
 */
export async function createOrGetGoogleUser(googleId: string, email: string): Promise<AccountUser> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);

  const [byGoogleId] = await db
    .select({ id: schema.users.id, email: schema.users.email, plan: schema.users.plan, emailVerified: schema.users.emailVerified })
    .from(schema.users)
    .where(eq(schema.users.googleId, googleId))
    .limit(1);
  if (byGoogleId) return byGoogleId;

  const [byEmail] = await db
    .select({ id: schema.users.id, email: schema.users.email, plan: schema.users.plan, emailVerified: schema.users.emailVerified })
    .from(schema.users)
    .where(eq(schema.users.normalizedEmail, normalizedEmail))
    .limit(1);
  if (byEmail) {
    await db.update(schema.users).set({ googleId, emailVerified: true }).where(eq(schema.users.id, byEmail.id));
    return { ...byEmail, emailVerified: true };
  }

  const [row] = await db
    .insert(schema.users)
    .values({ email: email.trim(), normalizedEmail, googleId, emailVerified: true })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      plan: schema.users.plan,
      emailVerified: schema.users.emailVerified,
    });
  return row;
}
