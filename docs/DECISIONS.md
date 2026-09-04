# Decisions

Ambiguities and deliberate scope decisions from the master build spec
(`SOCIALTRACE_MASTER_BUILD_SPEC.md`), per spec §2.3/§251.

## 2026-09-04 — Session scope: frontend scaffold only

The spec describes a multi-quarter product (backend, Postgres, Redis,
BullMQ, Stripe, snapshot/diff engine, auth, etc.) in what was an empty
repository. Building all of it in one session isn't realistic. The user
chose, when asked, to scope this session to the **frontend scaffold +
design system** (spec Release Phase 0 and the start of Phase 1 —
Milestones 1–3 of §228): repo bootstrap, design tokens, homepage, profile
page, posts, followers/following with search UI. Everything else
(database, job queues, real provider integration, auth, billing, exports,
snapshot/diff, tracking persistence, SEO content pages) is deferred — see
`docs/KNOWN_LIMITATIONS.md`.

## 2026-09-04 — No real data provider; mock adapter only

Spec §2.3 forbids inventing provider capabilities, and §34 requires the
domain/UI layer to depend only on a `SocialDataProvider` interface, never
a specific provider. No real Instagram data source was specified. The
user confirmed: build the `SocialDataProvider` interface and ship only a
deterministic mock implementation (`lib/providers/mock-provider.ts`).
Swapping in a real provider later means implementing the interface and
changing one export in `lib/providers/index.ts` — no UI or domain changes
required.

## 2026-09-04 — Single Next.js app, no monorepo yet

Spec §247 recommends Turborepo, but that's for a system with multiple
independently-deployable services (web app, API, workers). This slice has
exactly one app and no backend services, so a monorepo would add tooling
overhead with no present benefit (spec §2.2 — challenge avoidable
technical debt). Revisit when a separate API/worker process exists
(Milestone 5+, when a real provider + job queue are introduced).

## 2026-09-04 — No Fastify API layer yet

The mock provider runs in-process; Next.js Route Handlers under
`/api/v1/...` proxy to it for the followers/following endpoints so the
client-server contract (cursor pagination, server-side search) matches
the spec's real architecture (§12, §30) even though there's no separate
API service. A dedicated Fastify API becomes necessary once there's a
real provider, persistence, and background jobs to coordinate.

## 2026-09-04 — Database schema slice: Drizzle + Postgres, schema-only

Per the build order in spec §110/§228, the schema comes before a real
provider, snapshot engine, or API layer, since those all need tables to
write into. This slice adds `src/lib/db/schema.ts` (Drizzle ORM, matching
`docs/DATA_MODEL.md`'s mapping) and a generated migration under
`drizzle/`, using Postgres per the spec's stated stack (§247). Drizzle was
chosen over raw SQL/Prisma for TypeScript-first schema definitions that
stay close to the domain types without a separate codegen step. Deliberately
schema-only: no `PostgresProvider` implementation, no seed script, no live
database connected — `getDb()` in `src/lib/db/index.ts` is unused by the
app so this can be reviewed independently of any provider-swap decision.
See `docs/DATABASE.md`.

## 2026-09-04 — Real Instagram provider: Apify, with a 5-actor follower fallback chain

Building or licensing a first-party Instagram data pipeline is out of
scope for this project's stage. The user chose Apify (a marketplace of
pre-built scraping actors reached over a plain REST API, no scraping code
of our own to maintain) and tested actors live from this session using
their own Apify account. One actor (`apify/instagram-profile-scraper`)
reliably covers profile + recent posts. No single actor for follower/
following lists was clearly best, so the user asked to wire in all five
candidates found, tried in a fixed priority order with the next one
attempted on any failure — this maximizes the odds of getting real data
back on a given day, at the cost of more integration surface (five
normalizers instead of one). This is gated behind `SOCIAL_PROVIDER=apify`
(default stays `mock`) since Apify bills per result and the mock costs
nothing.

Follower/following fetches are capped at 200 users per profile per kind
(`MEMBER_FETCH_CAP`) rather than attempting "all of them" — for large
accounts this is a real (not simulated) instance of the coverage/partial-
data model the UI was built for. Pagination beyond what's fetched is
served from a same-process in-memory cache rather than re-invoking (and
re-billing) the actor chain on every "load more" click; this is
explicitly not a durable cache, and persisting results into the Postgres
schema from the prior slice is deferred to a future ingestion-job slice.

## 2026-09-04 — Dedicated reels actor + real (but debounced) username search

The user asked for real reels data (not the video-post approximation from
the first Apify slice) and an Instagram-style "type and see suggestions"
search box. `apify/instagram-reel-scraper` (the official, most-used reel
actor) replaces the approximation. For search, live testing in this
session found no actor offering true per-keystroke latency — the best
candidate (`nkactors/instagram-search-users-api-no-cookies-fast-reliable`,
which calls Instagram's own internal search endpoint) took ~6-7s per
call, an inherent cost of Apify's actor-run model, not something a
debounce can hide. Rather than fake instant results or silently degrade
to local-only matches, `ProfileSearchForm` debounces 500ms after typing
stops and shows an explicit "Searching Instagram…" loading state — an
honest slower-than-Instagram's-own search, consistent with this project's
data-honesty principle (spec §1.2) applied to UX latency, not just
dataset completeness.

## 2026-09-04 — Synchronous, bounded export instead of the spec's job-queue pipeline

Per the build order in spec §110/§228 (schema → provider → ... → export →
snapshot → diff → tracking), export comes next, and the user asked to
follow that order rather than jump to snapshot/diff/tracking. Spec §29
describes export as a background-job pipeline (queue → worker → stream →
compress → store → signed URL → expiration), which assumes auth, a job
queue, and blob storage — none of which exist yet in this build. Building
that pipeline now would mean queuing into nothing and signing URLs to
storage that doesn't exist.

Instead, `GET /api/v1/profiles/[profileId]/export` (`src/lib/export/`)
generates JSON/XML/CSV synchronously inside the request, bounded by
`EXPORT_LIST_LIMIT = 500` per list (reusing the existing paginated
`provider.getX()` calls), and streams the response directly with
`Content-Disposition: attachment` — no queue, no storage, no signed URL,
because none of those would be real. See `docs/EXPORT.md` for the full
scope decision and what changes once a job queue/storage exist.

## 2026-09-04 — Snapshot engine: synchronous capture, real writes to the Neon DB, and switching the DB driver to Neon HTTP

Continuing the spec's build order (§110/§228), Milestone 7 is the
snapshot engine — the first thing in this project that actually writes
to and reads from the Postgres schema from the earlier DB slice. Spec §19
describes a job-queue lifecycle (REQUESTED → QUEUED → ... → COMPLETED);
this build still has no job queue, so `captureSnapshot()`
(`src/lib/snapshot/capture.ts`) runs synchronously inside a POST request,
the same honest-scope reduction as the export system. It's bounded by
`SNAPSHOT_MEMBER_LIMIT = 500` followers/following per capture for the
same cost/latency reasons as `EXPORT_LIST_LIMIT`.

Two schema-level fixes were needed to make this real: `profiles` and
`social_users` gained unique indexes on `(platform, normalized_username)`
(`drizzle/0001_naive_multiple_man.sql`) so capture can upsert instead of
duplicating a row every time a snapshot is taken. And `src/lib/db/index.ts`
switched from the `postgres` (postgres.js, raw TCP) driver to
`@neondatabase/serverless` + `drizzle-orm/neon-http`. This isn't just the
earlier sandbox workaround for `drizzle-kit migrate` — it's now the
permanent app driver, because the project's real database is Neon and an
HTTP-based driver (one request per query, no persistent pool) is what a
serverless Next.js deployment actually wants. `drizzle-kit`'s own CLI
still needs a direct connection for `generate`/`migrate`, which is why
this session again used the one-off `drizzle-orm/neon-http/migrator`
script to apply the new migration from this sandbox.

A second, non-obvious bug surfaced and was fixed during live testing
against the real Neon database: the snapshot's `followerCoveragePercent`
was initially copied from `profile.followerCoverage.coveragePercent` (the
provider's own coverage claim), which showed "100% coverage, 500
indexed" for a profile with 42,183 followers — exactly the kind of
overstated-coverage mistake spec §1.2 exists to prevent. Fixed to compute
the snapshot's coverage from what it actually persisted
(`indexed / profile.followerCount`), so the snapshot history always
reflects what's really in the database, not what the provider claims it
could serve if asked without a cap. See `docs/SNAPSHOTS.md`.

## 2026-09-04 — Diff engine: computed at capture time, gated on coverage on both sides

Milestone 8 (spec §20). Rather than a separate "run the diff" step, the
diff against a profile's previous snapshot is computed inline inside
`captureSnapshot` (`src/lib/snapshot/capture.ts`), since a capture always
has both the old profile row and the new provider data in hand already —
recomputing it later from two `profile_snapshots` rows would need to
re-derive the same membership sets from `memberships`, for no benefit.
Results are written to `change_events` once, at capture time;
`src/lib/diff/changes.ts`'s `listChanges` only reads them.

The mandatory part of spec §20 — never infer mass removal from a
coverage drop — was implemented as a symmetric gate: membership diffing
for a kind (follower/following) only runs when **both** the previous and
current snapshot's coverage for that kind are ≥99.5%
(`DIFF_COVERAGE_THRESHOLD`). Below that on either side, no added/removed
`change_events` are written for that kind — not a partial/best-guess
diff, nothing at all. This also implies the rule protects against false
"added" claims, not just false "removed" ones: spec §20's example is
about removal, but a member missing from a *previous* partial capture
would look identically "new" in the next one if only the current side's
coverage were checked.

Verifying this live surfaced a real gap in the mock provider: neither
existing seed profile (`nike`, ~0.03% coverage; `smallcreator`, capped at
1.2% coverage by `SNAPSHOT_MEMBER_LIMIT`) ever reaches the 99.5%
threshold, so neither could exercise the membership-diff code path at
all. Added a third seed, `tinytest` (180 followers, 95 following, both
under the cap), specifically so the coverage-gated path is reachable
through the mock rather than only in theory. See `docs/DIFF.md` for the
full design and how it was verified against the live Neon database
(inserting a synthetic "phantom" membership between two real captures and
confirming it was correctly detected as removed, plus a synthetic stale
bio value correctly detected as a field change).

## 2026-09-04 — Tracking/Watchlist: anonymous cookie identity instead of accounts

Milestone 9 (spec §21). The spec's "Tracked profiles" dashboard assumes a
logged-in account; this build has no auth (`docs/KNOWN_LIMITATIONS.md`).
Rather than skip the milestone entirely or build throwaway auth just to
unblock it, tracking is scoped to an anonymous identity: a first-party
`st_visitor` cookie (random UUID, httpOnly), created the first time
someone clicks "Track profile," identifies their `watchlist_entries` rows
(`src/lib/db/schema.ts`). This is a real, working feature (the dashboard
at `/tracking` is genuinely backed by the database, not a mock), just
scoped to "this browser" instead of "this account" — an honest trade
consistent with how every other slice in this build has been scoped, and
one that upgrades cleanly to real accounts later (swap the cookie value
for a `users.id`).

The spec's "Tracking configuration" (check frequency, notification
channel, change categories, minimum threshold) was not implemented at
all, per spec §21's own instruction to "only expose frequencies the
backend can actually support" — this backend supports none, having no
scheduler or notification channel, so the dashboard instead asks the
visitor to manually recapture. See `docs/TRACKING.md` for the full scope
and how the follower-delta display avoids the diff engine's coverage-gate
(it's a whole-profile-count delta, not a membership-level claim, so
spec §20's rule doesn't apply to it). Verified live end-to-end against
the real Neon database: track/untrack via cookies, dashboard delta across
two real captures, and the profile header correctly reflecting tracked
state on reload.

## 2026-09-04 — Production hardening: the parts that don't need infrastructure this build lacks

Milestone 10 (spec §110/§228) is "production hardening + SEO launch," a
large bucket covering rate limiting, error handling, security headers,
health checks, structured data, moderation, and more. Rather than treat
it as one all-or-nothing milestone, this slice picked out exactly the
parts that are real and self-contained today: error boundaries
(`src/app/error.tsx`, `src/app/global-error.tsx`), security response
headers (`next.config.mjs`), a `GET /api/health` endpoint that actually
checks database connectivity (not just whether `DATABASE_URL` is set),
and a rate limiter (`src/lib/rate-limit.ts`) applied to the three routes
that do real per-request work: snapshot capture, export, and track.

Two things were deliberately left out with reasons recorded in
`docs/PRODUCTION_HARDENING.md` rather than silently skipped: a Content
Security Policy (there's nothing concrete to allowlist yet — this app
loads no third-party scripts) and SEO structured data on profile pages
(would assert real-looking claims — follower counts, verification — atop
pages backed by mock data by default, the same data-honesty concern
spec §1.2 already applies to the UI, applied to markup instead).

The rate limiter itself is an in-process `Map`, which is real protection
for a single long-lived process but not for a multi-instance serverless
deployment (Vercel) — documented explicitly as a known limitation rather
than shipped as if it were complete. Verified live: hammering the
snapshot-capture endpoint past its limit returned `429` with a
`Retry-After` header on the 11th request in the same 10-minute window,
using up to that point real (then cleaned-up) snapshot rows in the Neon
database; the health endpoint and security headers were also checked
live against the running dev server.

## 2026-09-04 — Follower comparison (spec §23): reconstruction, not a new table

The profile header's "Compare snapshots" button had been a disabled
placeholder since the earliest slice of this build. Implementing it
(`src/lib/diff/compare.ts`) turned out not to need a new per-snapshot
membership log table: `memberships.first_seen_at`/`removed_at` (already
present for the automatic diff engine, `docs/DIFF.md`) fully describe
each social user's membership timeline, so "who was active as of
snapshot X's captured_at" is a single query (`first_seen_at <= T AND
(removed_at IS NULL OR removed_at > T)`) against the existing schema —
for *any* two snapshots, not just consecutive ones. Reused
`DIFF_COVERAGE_THRESHOLD` from the diff engine unchanged, since a
comparison is the same "this specific account is gone" claim spec §20
already governs, just for an arbitrary pair instead of only the latest
one.

Verified live against the real Neon database with a scenario that
couldn't be produced through the deterministic mock provider alone (its
follower lists never change between captures): directly crafted a second
snapshot row and membership timeline changes (one real follower marked
removed between two timestamps, one brand-new follower inserted) to
confirm the reconstruction correctly classified each as new/removed, and
confirmed a synthetic low-coverage snapshot correctly produced
"unavailable" instead of a number. See `docs/FOLLOWER_COMPARISON.md`.

## 2026-09-04 — Saved searches: a thin filter over the comparison reconstruction

Spec §22. Rather than build a separate mechanism for "3 new matching
accounts, 1 removed matching account," `src/lib/tracking/saved-searches.ts`
reuses `compareSnapshots` (`docs/FOLLOWER_COMPARISON.md`) between a
profile's two most recent snapshots and filters the resulting
new/removed lists by the saved query string — a `saved_searches` table
just stores which `(profile, kind, query)` an anonymous visitor asked to
watch, the same cookie-identity scoping as tracking
(`docs/TRACKING.md`). This kept the feature to one new table and no new
diffing logic, and it automatically inherits the coverage gate: a saved
search on a low-coverage profile says "comparison unavailable" the same
way the comparison page would.

Verified live against the real Neon database: saved a search before any
snapshot existed (correctly showed "capture at least two snapshots"),
then crafted a second snapshot with one new and one removed follower and
confirmed two different saved queries each correctly isolated the match
relevant to them, and confirmed delete removes a saved search. Test data
cleaned up afterward. See `docs/SAVED_SEARCHES.md`.
