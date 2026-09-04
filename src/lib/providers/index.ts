/**
 * Provider selection point. Only the mock adapter exists today (see
 * docs/DECISIONS.md) — swapping in a real provider means implementing
 * SocialDataProvider and changing this one export, nothing else.
 */
import { mockProvider } from "./mock-provider";
import type { SocialDataProvider } from "./types";

export const provider: SocialDataProvider = mockProvider;

export * from "./types";
