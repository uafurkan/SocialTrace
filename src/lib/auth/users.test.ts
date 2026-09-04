import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./users";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  User@Example.com ")).toBe("user@example.com");
  });

  it("is idempotent", () => {
    expect(normalizeEmail(normalizeEmail("Foo@Bar.com"))).toBe("foo@bar.com");
  });
});
