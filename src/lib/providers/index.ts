/**
 * Provider selection point. Defaults to the mock adapter so nothing
 * starts costing money unless explicitly opted in — set
 * SOCIAL_PROVIDER=apify (+ APIFY_API_TOKEN) to use the real Instagram
 * data provider (see docs/PROVIDER_CONTRACT.md and docs/DECISIONS.md).
 */
import type { Platform } from "@/lib/domain/types";
import { apifyProvider } from "./apify";
import { apifyFacebookProvider } from "./apify/facebook";
import { apifyTikTokProvider } from "./apify/tiktok";
import { mockProvider } from "./mock-provider";
import { mockFacebookProvider } from "./mock/facebook-provider";
import { mockTikTokProvider } from "./mock/tiktok-provider";
import type { SocialDataProvider } from "./types";

const USE_APIFY = process.env.SOCIAL_PROVIDER === "apify";

export const provider: SocialDataProvider = USE_APIFY ? apifyProvider : mockProvider;

/** Per-platform provider lookup — `provider` above stays the Instagram default for every pre-existing call site. */
export function getProvider(platform: Platform): SocialDataProvider {
  switch (platform) {
    case "instagram":
      return provider;
    case "tiktok":
      return USE_APIFY ? apifyTikTokProvider : mockTikTokProvider;
    case "facebook":
      return USE_APIFY ? apifyFacebookProvider : mockFacebookProvider;
  }
}

export * from "./types";
