/**
 * Provider selection point. Production never serves mock data.
 *
 * - Production (and any build with NODE_ENV=production): the `unavailable`
 *   provider, unless SOCIAL_PROVIDER=apify is set explicitly.
 * - Development and tests: the mock adapters by default, so local work needs
 *   no keys.
 * - SOCIAL_PROVIDER=apify (+ APIFY_API_TOKEN) selects the Apify adapters. That
 *   path is kept for reference and is not the default. Its Instagram profile
 *   chain no longer calls undocumented endpoints.
 *
 * See docs/PROVIDER_CONTRACT.md and docs/DECISIONS.md.
 */
import type { Platform } from "@/lib/domain/types";
import { apifyProvider } from "./apify";
import { apifyFacebookProvider } from "./apify/facebook";
import { apifyTikTokProvider } from "./apify/tiktok";
import { mockProvider } from "./mock-provider";
import { mockFacebookProvider } from "./mock/facebook-provider";
import { mockTikTokProvider } from "./mock/tiktok-provider";
import { UnavailableProvider } from "./unavailable-provider";
import type { SocialDataProvider } from "./types";

type SourceMode = "mock" | "apify" | "unavailable";

function sourceMode(): SourceMode {
  // An empty value (a blank field in the Vercel UI) counts as unset.
  const configured = process.env.SOCIAL_PROVIDER || undefined;
  if (configured === "apify") return "apify";
  if (process.env.NODE_ENV === "production") return "unavailable";
  if (configured === "mock" || configured === undefined) return "mock";
  return "unavailable";
}

const MODE = sourceMode();

const unavailableInstagram = new UnavailableProvider("instagram");
const unavailableTikTok = new UnavailableProvider("tiktok");
const unavailableFacebook = new UnavailableProvider("facebook");

export const provider: SocialDataProvider =
  MODE === "apify" ? apifyProvider : MODE === "mock" ? mockProvider : unavailableInstagram;

/** Per-platform provider lookup — `provider` above stays the Instagram default for every pre-existing call site. */
export function getProvider(platform: Platform): SocialDataProvider {
  switch (platform) {
    case "instagram":
      return provider;
    case "tiktok":
      return MODE === "apify" ? apifyTikTokProvider : MODE === "mock" ? mockTikTokProvider : unavailableTikTok;
    case "facebook":
      return MODE === "apify" ? apifyFacebookProvider : MODE === "mock" ? mockFacebookProvider : unavailableFacebook;
  }
}

export * from "./types";
