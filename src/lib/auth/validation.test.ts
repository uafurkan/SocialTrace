import { describe, expect, it } from "vitest";

import { loginSchema, signupSchema } from "./validation";

describe("signupSchema", () => {
  it("accepts a valid email and an 8+ character password", () => {
    const result = signupSchema.safeParse({ email: "user@example.com", password: "longenough" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ email: "not-an-email", password: "longenough" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ email: "user@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("trims the email", () => {
    const result = signupSchema.safeParse({ email: "  user@example.com  ", password: "longenough" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (length is checked at signup, not login)", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
