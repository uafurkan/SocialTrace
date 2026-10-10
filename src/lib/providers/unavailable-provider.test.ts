import { afterEach, describe, expect, it, vi } from "vitest";

import type { SocialDataProvider } from "./types";

/**
 * Errors are matched by `name`, not by class. Each dynamic import below runs
 * after vi.resetModules(), so the class identity would differ from one import
 * to the next.
 */
const UNAVAILABLE = { name: "ProviderUnavailableError" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("provider selection", () => {
  it("never serves mock data in production, even when SOCIAL_PROVIDER=mock is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SOCIAL_PROVIDER", "mock");
    const { provider, getProvider } = await import("./index");

    expect(provider.capabilities.profile).toBe(false);
    await expect(provider.getProfile("nike")).rejects.toMatchObject(UNAVAILABLE);
    await expect(getProvider("tiktok").getProfile("nike")).rejects.toMatchObject(UNAVAILABLE);
    await expect(getProvider("facebook").getPosts("profile_nike")).rejects.toMatchObject(UNAVAILABLE);
  });

  it("uses the mock adapter in development when nothing is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SOCIAL_PROVIDER", "");
    const { provider } = await import("./index");

    expect(provider.capabilities.profile).toBe(true);
  });
});

describe("UnavailableProvider", () => {
  it("fails every call with ProviderUnavailableError and never returns a value", async () => {
    const { UnavailableProvider } = await import("./unavailable-provider");
    // Called through the interface, so the calls type-check against the real signatures.
    const unavailable: SocialDataProvider = new UnavailableProvider("instagram");

    await expect(unavailable.getPosts("profile_nike")).rejects.toMatchObject(UNAVAILABLE);
    await expect(unavailable.getFollowers("profile_nike")).rejects.toMatchObject(UNAVAILABLE);
    await expect(unavailable.getLikers("https://www.instagram.com/p/abc/")).rejects.toMatchObject(UNAVAILABLE);
  });

  it("reports every capability as off, so pages skip their calls", async () => {
    const { UnavailableProvider } = await import("./unavailable-provider");
    const { capabilities } = new UnavailableProvider("tiktok");

    expect(Object.values(capabilities).every((on) => on === false)).toBe(true);
  });
});
