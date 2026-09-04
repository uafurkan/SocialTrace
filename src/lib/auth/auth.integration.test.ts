import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isDbConfigured } from "@/lib/db";
import { createUser, verifyCredentials, InvalidCredentialsError, EmailAlreadyRegisteredError } from "@/lib/auth/users";
import { createSession, getSessionUserByToken, invalidateSession } from "@/lib/auth/session";
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
});
