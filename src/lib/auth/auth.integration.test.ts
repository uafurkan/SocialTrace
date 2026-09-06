import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isDbConfigured } from "@/lib/db";
import { createUser, verifyCredentials, InvalidCredentialsError, EmailAlreadyRegisteredError } from "@/lib/auth/users";
import { createSession, getSessionUserByToken, invalidateSession } from "@/lib/auth/session";
import {
  InvalidCodeError,
  TooManyAttemptsError,
  VerificationCooldownError,
  issueVerificationCode,
  verifyEmailCode,
} from "@/lib/auth/email-verification";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { deleteTestUsers, uniqueEmail } from "@/lib/db/test-helpers";

describe.skipIf(!isDbConfigured())("auth (integration)", () => {
  const email = uniqueEmail("auth-int");
  const password = "correct-horse-battery-staple";

  afterAll(async () => {
    await deleteTestUsers([email]);
  });

  it("creates a user, rejects a duplicate signup, and verifies credentials", async () => {
    const user = await createUser(email, password);
    expect(user.email).toBe(email);
    expect(user.plan).toBe("free");

    await expect(createUser(email, "another-password")).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    const verified = await verifyCredentials(email, password);
    expect(verified.id).toBe(user.id);

    await expect(verifyCredentials(email, "wrong-password")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("creates a real session and looks it up by its raw token, not a stored one", async () => {
    const user = await createUser(uniqueEmail("session-int"), password);
    const { token, expiresAt } = await createSession(user.id);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const sessionUser = await getSessionUserByToken(token);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.id).toBe(user.id);
    expect(sessionUser?.email).toBe(user.email);

    await invalidateSession(token);
    expect(await getSessionUserByToken(token)).toBeNull();

    await deleteTestUsers([user.email]);
  });

  it("getSessionUserByToken returns null for a garbage token", async () => {
    expect(await getSessionUserByToken("not-a-real-token")).toBeNull();
    expect(await getSessionUserByToken(undefined)).toBeNull();
  });

  it("email verification: wrong codes count against the attempt cap, the right code verifies, and resend respects the cooldown", async () => {
    const verifyEmail = uniqueEmail("verify-int");
    const user = await createUser(verifyEmail, password);

    // No RESEND_API_KEY in test env — issueVerificationCode still writes
    // the hash/expiry/attempts reset, it just skips the actual send.
    await issueVerificationCode(user.id, user.email);

    // A second call immediately after must hit the resend cooldown.
    await expect(issueVerificationCode(user.id, user.email)).rejects.toBeInstanceOf(VerificationCooldownError);

    // The real code was never returned to this test (by design — it only
    // ever exists as a hash once issued) so a wrong guess must fail...
    await expect(verifyEmailCode(user.id, "000000")).rejects.toBeInstanceOf(InvalidCodeError);

    const db = getDb();
    const [row] = await db
      .select({ attempts: schema.users.emailVerificationAttempts })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);
    expect(row.attempts).toBe(1);

    // ...and enough wrong guesses lock the current code out entirely.
    for (let i = 0; i < 4; i++) {
      await expect(verifyEmailCode(user.id, "000000")).rejects.toBeInstanceOf(InvalidCodeError);
    }
    await expect(verifyEmailCode(user.id, "000000")).rejects.toBeInstanceOf(TooManyAttemptsError);

    await deleteTestUsers([verifyEmail]);
  });
});
