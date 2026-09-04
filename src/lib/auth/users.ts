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
    .returning({ id: schema.users.id, email: schema.users.email, plan: schema.users.plan });
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
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.normalizedEmail, normalizedEmail))
    .limit(1);
  if (!row) throw new InvalidCredentialsError();

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return { id: row.id, email: row.email, plan: row.plan };
}
