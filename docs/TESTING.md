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
- **`src/lib/auth/password.test.ts`** — bcrypt round-trip (hash → verify
  correct/incorrect password), and that hashing the same password twice
  produces different hashes (random salt per call).
- **`src/lib/auth/session.test.ts`** — `hashSessionToken` is
  deterministic, never returns the raw token, and produces a 64-char
  hex SHA-256 digest.
- **`src/lib/auth/users.test.ts`** — `normalizeEmail` (trim + lowercase).
- **`src/lib/auth/validation.test.ts`** — the signup/login Zod schemas
  (email format, 8-character minimum on signup only, trimming).
- **`src/lib/billing/plans.test.ts`** — `assertWithinLimit` allows up to
  the limit and throws `PlanLimitError` at it, the pro plan never
  throws, and the error message names the plan and limit.

69 tests across 12 files as of this slice.

## Integration tests (`npm run test:integration`)

Separate from the suite above: `*.integration.test.ts` files run
against the **real** Neon database from `.env.local`, using a separate
Vitest config (`vitest.integration.config.mts`) so `npm test` stays
fast and network-free. Asked which approach to use — the real dev DB,
`pg-mem`, or a Neon branch-per-CI-run — the choice was the real dev DB:
`pg-mem` runs a different driver (`node-postgres`) than production
(`drizzle-orm/neon-http`) and specifically would **not** have caught the
drizzle-orm query-builder bug found while building the scheduler (see
`docs/DECISIONS.md`) — a fake-Postgres layer only ever tests against
its own reimplementation, not the real driver's real behavior. A Neon
branch-per-run needs a Neon API key and a CI pipeline, neither of which
exist in this build.

- **`src/lib/db/test-helpers.ts`** — shared `uniqueUsername`/
  `uniqueEmail` (per-run-unique so parallel/repeated runs don't collide)
  and `deleteTestProfiles`/`deleteTestUsers` cleanup, relying on the
  schema's cascading FKs (deleting a `profiles` row cascades to
  memberships, snapshots, watchlist entries, saved searches, and change
  events; deleting a `users` row cascades to `sessions`) so a test only
  has to remember the usernames/emails it created.
- **`src/lib/auth/auth.integration.test.ts`** — real signup → duplicate
  rejection → login → wrong-password rejection, and a real session
  created, looked up by its raw token, and invalidated (via
  `createSession`/`getSessionUserByToken`/`invalidateSession` against
  the real `sessions`/`users` tables — the SHA-256 hashing in between is
  exercised for real, not mocked).
- **`src/lib/tracking/tracking.integration.test.ts`** — track/untrack
  round-trip, the free-plan tracked-profile limit thrown for real at 11
  profiles, the no-op-safe re-track-at-the-limit case, and a saved
  search created/listed (correctly `available: false` before two
  snapshots exist)/deleted.
- **`src/lib/snapshot/capture.integration.test.ts`** — `captureSnapshot`
  against the mock provider persists a real row and a second capture
  adds a second row without erroring the diff/upsert path;
  `ProfileNotFoundError` for the mock provider's known-missing
  usernames.
- **`src/lib/snapshot/scheduled-capture.integration.test.ts`** —
  regression coverage for the drizzle-orm bug above: tracks one profile,
  saved-searches a *different* profile, and asserts `runScheduledCapture`
  captures both (the bug would have silently dropped the saved-search-only
  one from `attempted`) plus a dedup check for a profile that's both
  tracked and saved-searched. Re-running this suite with the join
  temporarily reverted to the query-builder form did **not** reproduce
  the original failure in a fresh Vitest process — see `docs/DECISIONS.md`
  for why the raw-`execute()` fix stays regardless (proven correct in
  both the process shape that failed and the one that didn't; the query
  builder is only proven correct in one of them).

Confirmed live: `npm run test:integration` passes (4 files, 11 tests)
against the real database, and a follow-up query against Neon directly
confirmed zero leftover `profiles`/`users` rows afterward.

## What's deliberately not covered yet

- **Components.** No React Testing Library / jsdom setup yet — UI was
  verified with Playwright against a running dev server per change
  (screenshots, not committed as a suite).
- **The Apify provider.** Its actors are real, billed, external
  services; no recorded-fixture/VCR-style testing exists yet.
- **Most API routes** (the HTTP layer itself — request parsing, cookie
  setting, status codes) — the integration tests above exercise the
  library functions those routes call, not the routes; each route's own
  doc's "Verified live" section covers manual `curl` verification of the
  HTTP layer per slice.

## When this needs to change

A CI pipeline (GitHub Actions or similar) would need either a Neon
branch created per run or a `DATABASE_URL` secret pointing at a
persistent test database — `npm run test:integration` already skips
cleanly via `describe.skipIf(!isDbConfigured())` when `DATABASE_URL`
isn't set, so wiring it into CI is adding the secret, not changing the
tests. Until then, each new DB-touching feature should get an
integration test alongside its manual "Verified live" check, the same
way this slice's four files were added.
