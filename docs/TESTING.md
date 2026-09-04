# Testing

Spec doesn't mandate a specific framework; this build had zero automated
tests until this slice (`docs/KNOWN_LIMITATIONS.md` called it out
explicitly). This adds unit tests for the pure logic behind the
product's core invariants — coverage math and the diff-engine's honesty
rule — without requiring a live database in CI or this sandbox.

## Stack

[Vitest](https://vitest.dev/) — `npm test` (single run) /
`npm run test:watch`. `vitest.config.mts` resolves the `@/*` path alias
natively (`resolve.tsconfigPaths: true`), no separate plugin needed.
Tests are co-located as `<name>.test.ts` next to the module they cover.

## What's covered

All of this is pure-function testing — no database, no network, no
mocking of Drizzle or Neon:

- **`src/lib/snapshot/capture.test.ts`** — `normalizeUsername`,
  `coveragePercentFor` (the adaptive-precision rounding behind every
  coverage badge in the product; spec §1.2's "never round a tiny
  non-zero coverage down to a literal 0%" rule is asserted directly).
- **`src/lib/diff/compare.test.ts`** — `evaluateCoverageGate` and
  `diffActiveMembers`, extracted as pure functions from
  `compareSnapshots` specifically so the coverage-gate decision and the
  membership reconciliation could be tested independent of the two
  database round-trips `compareSnapshots` also does. This is the same
  logic Follower Comparison and Saved Searches both depend on
  (`docs/FOLLOWER_COMPARISON.md`, `docs/SAVED_SEARCHES.md`).
- **`src/lib/tracking/saved-searches.test.ts`** — `matches` (username/
  display-name substring filter), exported for the same reason.
- **`src/lib/profile-link.test.ts`** — `extractUsername`, moved out of
  `ProfileSearchForm` into its own module specifically so the URL/
  username parsing (bare username, full profile link, protocol-less
  domain, rejected non-profile paths) could be unit tested without
  rendering the component (`docs/SEARCH.md`).
- **`src/lib/rate-limit.test.ts`** — allow-up-to-limit, block-over-limit,
  window reset (via `vi.useFakeTimers`), and independent keys.
- **`src/lib/avatar-color.test.ts`** — deterministic palette assignment
  and initials derivation (`docs/SEARCH.md`).
- **`src/lib/utils.test.ts`** — `formatCount` (K/M/B thresholds) and
  `formatRelativeTime` (minute/hour/day boundaries, via fake timers).

48 tests across 7 files as of this slice.

## What's deliberately not covered yet

- **Anything that touches `getDb()`** — snapshot capture end-to-end,
  the tracking/watchlist/saved-search DB writes, the API routes
  themselves. These were verified manually and live against the real
  Neon database for each slice (see each feature's own doc's "Verified
  live" section) but aren't automated — that needs either a disposable
  test database or a mocking layer for Drizzle's query builder, neither
  of which exists yet.
- **Components.** No React Testing Library / jsdom setup yet — UI was
  verified with Playwright against a running dev server per change
  (screenshots, not committed as a suite).
- **The Apify provider.** Its actors are real, billed, external
  services; no recorded-fixture/VCR-style testing exists yet.

## When this needs to change

The natural next step is a disposable-database integration layer (a
Neon branch created per CI run, or `pg-mem`/similar) so
`captureSnapshot`, `compareSnapshots`, and the tracking/saved-search
read paths can be tested end-to-end rather than only at their pure
core. Until then, each new coverage-gated or diff-adjacent feature
should keep extracting its decision logic into a pure, exported
function the way `evaluateCoverageGate`/`diffActiveMembers` were, so it
stays testable without a database.
