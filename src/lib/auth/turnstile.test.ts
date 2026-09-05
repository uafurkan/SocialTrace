import { afterEach, describe, expect, it, vi } from "vitest";

import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile";

describe("turnstile", () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  it("reports not configured when TURNSTILE_SECRET_KEY is unset", () => {
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("reports configured when TURNSTILE_SECRET_KEY is set", () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(isTurnstileConfigured()).toBe(true);
  });

  it("always passes verification when unconfigured, regardless of token", async () => {
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(true);
    await expect(verifyTurnstileToken(null)).resolves.toBe(true);
    await expect(verifyTurnstileToken("anything")).resolves.toBe(true);
  });

  it("rejects a missing token when configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false);
    await expect(verifyTurnstileToken(null)).resolves.toBe(false);
  });

  it("accepts a valid token when Cloudflare confirms success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstileToken("valid-token")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects when Cloudflare reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));

    await expect(verifyTurnstileToken("bad-token")).resolves.toBe(false);
  });

  it("rejects when the verification request itself fails", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(verifyTurnstileToken("token")).resolves.toBe(false);
  });
});
