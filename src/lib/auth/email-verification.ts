import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email/resend";

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export class VerificationCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Please wait before requesting another code.");
    this.name = "VerificationCooldownError";
  }
}

export class InvalidCodeError extends Error {
  constructor() {
    super("Invalid or expired code.");
    this.name = "InvalidCodeError";
  }
}

export class TooManyAttemptsError extends Error {
  constructor() {
    super("Too many incorrect attempts. Request a new code.");
    this.name = "TooManyAttemptsError";
  }
}

export class AlreadyVerifiedError extends Error {
  constructor() {
    super("This email is already verified.");
    this.name = "AlreadyVerifiedError";
  }
}

/** Same reasoning as `hashSessionToken`/`hashPassword` — the code itself is never persisted, only this hash, so a leaked database row alone can't complete verification. */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  // Both are fixed-length hex-encoded SHA-256 digests, so a length
  // mismatch can only mean corrupt/foreign input, not a valid comparison.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function generateCode(): string {
  // randomInt is cryptographically secure (unlike Math.random), and the
  // inclusive-low/exclusive-high range keeps the code a fixed 6 digits
  // (padded) rather than sometimes shorter.
  const max = 10 ** CODE_LENGTH;
  return randomInt(0, max).toString().padStart(CODE_LENGTH, "0");
}

function verificationEmailHtml(code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111;">Verify your email</h2>
      <p style="color: #444; font-size: 15px;">Enter this code to verify your SocialTrace account:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111; margin: 24px 0;">${code}</p>
      <p style="color: #777; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `.trim();
}

/**
 * Issues a fresh code (invalidating any previous one), emails it, and
 * persists only its hash. Enforces the resend cooldown itself — callers
 * (signup, the resend endpoint) don't need to duplicate that check.
 * Email delivery failure propagates to the caller: signup treats it as
 * best-effort (logs and continues, since the account itself still works),
 * the resend endpoint treats it as a real failure to report.
 */
export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const db = getDb();
  const [user] = await db
    .select({ emailVerified: schema.users.emailVerified, sentAt: schema.users.emailVerificationSentAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return;
  if (user.emailVerified) throw new AlreadyVerifiedError();

  if (user.sentAt) {
    const elapsedMs = Date.now() - user.sentAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      throw new VerificationCooldownError(Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000));
    }
  }

  const code = generateCode();
  const now = new Date();
  await db
    .update(schema.users)
    .set({
      emailVerificationCodeHash: hashCode(code),
      emailVerificationExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
      emailVerificationAttempts: 0,
      emailVerificationSentAt: now,
    })
    .where(eq(schema.users.id, userId));

  if (!isEmailConfigured()) return; // opt-in, same pattern as every other real integration here
  await sendEmail({ to: email, subject: "Your SocialTrace verification code", html: verificationEmailHtml(code) });
}

/**
 * Verifies a submitted code against the stored hash. Wrong guesses
 * increment `emailVerificationAttempts`; hitting `MAX_ATTEMPTS` locks the
 * current code out (a fresh `issueVerificationCode` call is required) —
 * caps how many guesses a 6-digit code (1M possibilities) can be brute-
 * forced before it's forced to rotate anyway at its 10-minute expiry.
 */
export async function verifyEmailCode(userId: string, submittedCode: string): Promise<void> {
  const db = getDb();
  const [user] = await db
    .select({
      emailVerified: schema.users.emailVerified,
      codeHash: schema.users.emailVerificationCodeHash,
      expiresAt: schema.users.emailVerificationExpiresAt,
      attempts: schema.users.emailVerificationAttempts,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) throw new InvalidCodeError();
  if (user.emailVerified) throw new AlreadyVerifiedError();
  if (!user.codeHash || !user.expiresAt) throw new InvalidCodeError();
  if (user.attempts >= MAX_ATTEMPTS) throw new TooManyAttemptsError();
  if (user.expiresAt <= new Date()) throw new InvalidCodeError();

  const match = /^\d{6}$/.test(submittedCode) && hashesMatch(hashCode(submittedCode), user.codeHash);
  if (!match) {
    await db
      .update(schema.users)
      .set({ emailVerificationAttempts: user.attempts + 1 })
      .where(eq(schema.users.id, userId));
    throw new InvalidCodeError();
  }

  await db
    .update(schema.users)
    .set({
      emailVerified: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: null,
    })
    .where(eq(schema.users.id, userId));
}
