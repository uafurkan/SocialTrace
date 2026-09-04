/**
 * Provider selection point. Defaults to the mock adapter so nothing
 * starts costing money unless explicitly opted in — set
 * SOCIAL_PROVIDER=apify (+ APIFY_API_TOKEN) to use the real Instagram
 * data provider (see docs/PROVIDER_CONTRACT.md and docs/DECISIONS.md).
 */
import { apifyProvider } from "./apify";
import { mockProvider } from "./mock-provider";
import type { SocialDataProvider } from "./types";

export const provider: SocialDataProvider = process.env.SOCIAL_PROVIDER === "apify" ? apifyProvider : mockProvider;

export * from "./types";
