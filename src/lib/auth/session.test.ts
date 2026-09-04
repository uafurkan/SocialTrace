import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./session";

describe("hashSessionToken", () => {
  it("is deterministic for the same token", () => {
    expect(hashSessionToken("abc123")).toBe(hashSessionToken("abc123"));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashSessionToken("token-a")).not.toBe(hashSessionToken("token-b"));
  });

  it("never returns the raw token", () => {
    const token = "super-secret-session-token";
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("produces a 64-character hex string (SHA-256)", () => {
    expect(hashSessionToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
