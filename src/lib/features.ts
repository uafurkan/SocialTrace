/**
 * Which product areas are live. The site is monetized through ads only
 * (docs/ADS.md), so everything that needed an account, a paid plan, or
 * server-side saved history is switched off here.
 *
 * Flipping a flag back to true restores that area's navigation, pages and
 * API routes — nothing else changes. The code and database tables are kept
 * on purpose. The environment variables that only these areas read (auth,
 * Paddle, Resend, Turnstile, Google sign-in, tracking/cron) have no effect
 * while their flag is false.
 *
 * Not behind a flag, because they never needed an account: profile lookups,
 * posts/reels/stories, followers/following, export, the transcriber and the
 * other tools.
 */
export const FEATURES = {
  /** Login, signup, Google sign-in, /account, /admin and admin diagnostics. */
  accounts: false,
  /** /pricing and Paddle checkout, billing portal and webhook. */
  billing: false,
  /** Track button, /tracking dashboard, saved searches, nav badge and the daily capture cron. */
  tracking: false,
  /** Snapshot capture, profile History/Changes/Compare, and the tool pages built on snapshots. */
  snapshots: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

interface GatedRoute {
  feature: FeatureName;
  /** Matched against the request pathname, so it covers both pages and /api routes. */
  pattern: RegExp;
}

const GATED_ROUTES: GatedRoute[] = [
  { feature: "accounts", pattern: /^\/(login|signup|account|admin)(\/|$)/ },
  { feature: "accounts", pattern: /^\/api\/v1\/(auth|diagnostics)(\/|$)/ },

  { feature: "billing", pattern: /^\/pricing(\/|$)/ },
  { feature: "billing", pattern: /^\/api\/v1\/billing(\/|$)/ },

  { feature: "tracking", pattern: /^\/tracking(\/|$)/ },
  { feature: "tracking", pattern: /^\/api\/v1\/(tracking|saved-searches)(\/|$)/ },
  { feature: "tracking", pattern: /^\/api\/v1\/profiles\/[^/]+\/track(\/|$)/ },
  { feature: "tracking", pattern: /^\/api\/cron(\/|$)/ },

  { feature: "snapshots", pattern: /^\/profile\/[^/]+\/(history|changes|compare)(\/|$)/ },
  { feature: "snapshots", pattern: /^\/api\/v1\/profiles\/[^/]+\/(snapshots|changes|compare)(\/|$)/ },
  { feature: "snapshots", pattern: /^\/help\/(snapshots|compare)(\/|$)/ },
  { feature: "tracking", pattern: /^\/help\/(tracking|saved-searches)(\/|$)/ },
  {
    feature: "snapshots",
    pattern: /^\/tools\/instagram-(follower-history|follower-compare|growth-tracker|bio-history|username-history)(\/|$)/,
  },
];

/** False when `pathname` belongs to a feature that is switched off. */
export function isPathEnabled(pathname: string): boolean {
  return !GATED_ROUTES.some(({ feature, pattern }) => !FEATURES[feature] && pattern.test(pathname));
}
