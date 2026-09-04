import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("never stores the plaintext password", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(hash).not.toBe("correcthorsebattery");
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(await verifyPassword("correcthorsebattery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [hashA, hashB] = await Promise.all([hashPassword("samepassword"), hashPassword("samepassword")]);
    expect(hashA).not.toBe(hashB);
  });
});
