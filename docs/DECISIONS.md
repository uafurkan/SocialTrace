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

## 2026-09-04 — SEO content pages: real features only, no scaled content

Spec §45–§97 asks for a help center, changelog, FAQ, data methodology
page, and tool landing pages, but spec §45/§57 explicitly forbid scaled/
doorway content — near-identical pages that exist only to catch keyword
variants. Rather than generate landing pages for all 13 tools named in
spec §46, only three were built
(`/tools/instagram-follower-history`, `/tools/instagram-follower-compare`,
`/tools/instagram-growth-tracker`) — the three with a real, working
feature behind them (snapshot history, the Compare view, the tracking
dashboard). The other 10 stay listed on `/tools` as "Coming soon" rather
than getting a landing page with no real tool to link to.

Help articles (`src/lib/seo/help-articles.ts`), changelog entries
(`src/lib/seo/changelog-entries.ts`), and FAQ entries
(`src/lib/seo/faq-entries.ts`) are plain TypeScript data modules, not a
CMS — there's no authoring workflow to build yet for seven help articles
and a changelog with one entry per shipped slice. JSON-LD
(`src/lib/seo/json-ld.tsx`) centralizes escaping (`<` → `<`) per the
Next.js JSON-LD guide's XSS warning (spec §53/§209) so every page that
emits structured data goes through one audited helper rather than
hand-rolling `JSON.stringify` per page.

No blog (spec §94) and no programmatic profile SEO (spec §47) in this
slice — both require either human-authored long-form content or a real,
resolved-and-indexed profile dataset, neither of which this slice can
manufacture honestly. See `docs/SEO.md`.

## 2026-09-04 — Search UX: honest mock quality, not a provider switch

The homepage search box's mock suggestions padded unmatched queries
with a random 3-digit suffix (`query483`) — deterministic, but reads as
noise since the digits carry no meaning, and every mock profile has an
empty `avatarUrl` so every result rendered as a flat gray circle. The
user asked to fix both, and separately asked whether to switch the
default provider to real Apify data to get real accounts/photos — the
answer was no, stay on mock (still free by default; a provider switch
is a cost decision for later). So both fixes had to work within mock
data's own honesty constraint: `src/lib/providers/mock-provider.ts`
now pads unmatched queries with plausible word-suffixed handles
(`nikeofficial`, `nikehq`, ...) instead of digits, only as many as
needed to fill the requested limit — but this is still fabricated
data, not a real Instagram lookup, and the UI/docs say so plainly
(`docs/SEARCH.md`).

For the missing photos, rather than fake an image, `src/components/ui/avatar.tsx`
renders a deterministic colored-initials fallback (hash of username →
one of 6 token-defined color pairs in `src/styles/tokens.css`) so the
same identity gets the same visual treatment everywhere it appears —
replacing five near-duplicate inline avatar blocks (profile header,
followers/following list, tracking dashboard, snapshot comparison,
search suggestions) with one shared component. Falls back the same way
if a real `avatarUrl` ever 404s, rather than showing a broken image
icon. See `docs/SEARCH.md`.

## 2026-09-04 — Removed search-as-you-type entirely; full username or link only

Follow-up to the previous entry: polishing the mock suggestions'
synthetic entries made them look more like real accounts they weren't,
which cut against this build's core honesty rule, and the underlying
mechanism — a debounced suggestions box calling `provider.searchUsers`
on a pause in typing — was designed to eventually call a paid Apify
search actor per call. The user asked to remove the cost risk at the
root rather than tune the debounce: require the full username or a
pasted profile link, and do exactly one lookup on submit — the same
single `getProfile` call viewing the profile page makes anyway, so
"just typing" a query can never cost more than actually opening a
profile does.

Removed rather than left dormant: `src/app/api/v1/search/route.ts`,
`src/lib/providers/apify/search.ts`, and `searchUsers`/`userSearch`
from `SocialDataProvider`/`ProviderCapabilities` and both
implementations. `ProfileSearchForm` now parses either a bare username
or an `instagram.com/<username>` URL client-side
(`extractUsername`), rejecting non-profile paths (`/p/`, `/reel/`,
etc.) instead of guessing. See `docs/SEARCH.md`.

## 2026-09-04 — Vitest for pure-logic unit tests, no test database yet

The project had zero automated tests. Rather than reach for a
disposable-test-database setup immediately (real infrastructure work:
either a Neon branch per CI run or a Postgres-compatible in-memory
mock, neither of which exists), this slice targets what's already
testable without one: the pure decision logic behind the product's
core invariants. `evaluateCoverageGate` and `diffActiveMembers` were
extracted out of `compareSnapshots` (`src/lib/diff/compare.ts`)
specifically so the coverage-gate check and the membership
reconciliation — the same logic Follower Comparison and Saved Searches
both depend on — could be unit tested independent of the two database
round-trips the full function also makes. `coveragePercentFor` (already
pure) was exported from `src/lib/snapshot/capture.ts` for the same
reason, and `extractUsername` was moved out of `ProfileSearchForm` into
its own module (`src/lib/profile-link.ts`) so URL/username parsing
could be tested without rendering the component.

Vitest was chosen over Jest for zero-config TypeScript + ESM support
and native tsconfig path-alias resolution (`resolve.tsconfigPaths` —
no separate plugin needed). Tests are co-located as `<name>.test.ts`
next to the module they cover rather than in a parallel `__tests__/`
tree, so a reader finds the tests exactly where they'd look for the
implementation. See `docs/TESTING.md` for what's covered and what
still needs a real (or mocked) database to test.

## 2026-09-04 — Email + password accounts; plan limits with no payment behind them

Asked which auth method and how far to take billing: chose email +
password (no OAuth client credentials, no email-sending service for
magic links, so this was the only method buildable without another
external dependency) and "plan/limit infrastructure only, no payment" —
real enforcement, no Stripe. Both are documented in full in
`docs/AUTH.md`/`docs/BILLING.md`; the decisions worth recording here are
the two structural ones:

**Tracking/saved searches upgrade to accounts without a schema
migration.** Both features were built (`docs/TRACKING.md`,
`docs/SAVED_SEARCHES.md`) storing a plain `visitor_id` string, with both
docs explicitly flagging "swap the cookie value for a `users.id` once
accounts exist" as the future upgrade path. `src/lib/auth/identity.ts`'s
`resolveIdentity` does exactly that at read/write time — a signed-in
visitor's scope becomes `account:<userId>`, an anonymous one keeps the
cookie — so no migration touches `watchlist_entries` or
`saved_searches` at all. This is the payoff of having written that
upgrade note down when the tables were designed instead of hard-coding
an assumption.

**Session tokens are hashed, matching the existing password-hashing
precedent.** `sessions.token_hash` stores SHA-256 of the random session
token, never the token itself — the same reasoning `bcryptjs` already
established for `users.passwordHash`: a leaked database row shouldn't
be enough to act as that credential. bcryptjs (not native `bcrypt`) to
avoid native bindings, consistent with the project's serverless-first
driver choices elsewhere (`docs/DATABASE.md`'s Neon HTTP driver
reasoning).

**Discovered and fixed mid-slice: reading the session cookie in
`SiteHeader` broke static generation for every page.** `SiteHeader` is
shared by every route including the SEO content pages built earlier
(`/changelog`, `/help`, the tool landing pages). Making it an async
Server Component that called `cookies()` (via `resolveIdentityReadOnly`)
turned every one of those pages from statically prerendered (`○`) to
fully dynamic (`ƒ`) in `next build`'s output — confirmed by diffing the
build output before and after. Fixed by moving the auth-state read into
a client-side island (`AccountMenu`, `GET /api/v1/auth/me` in a
`useEffect`) so only that one header slot is dynamic; the rest of the
page tree stays static. See `docs/AUTH.md`.

## Mobile header + layout overflow fixes

`SiteHeader` previously hid both the nav links and `AccountMenu` behind
`md:flex` with no mobile fallback at all — on a phone there was
literally no way to reach `/tracking`, `/pricing`, sign in, or sign out.
Added `MobileNav` (`src/components/layout/mobile-nav.tsx`): a hamburger
button revealing a dropdown panel with the nav links and `AccountMenu`
stacked, closing on link click or on a backdrop click outside it. The
mobile header layout is a 3-column grid (`hamburger | centered logo |
spacer`) so the logo is genuinely centered regardless of the hamburger
button's width, matching the "logo and search centered in the top bar"
ask; a compact `ProfileSearchForm` renders as a second row below the
top bar on mobile only, so a username/profile-link search is reachable
from every page, not just the homepage hero.

While auditing mobile at 375px width, found and fixed two real
horizontal-overflow bugs (verified via `document.documentElement.
scrollWidth > clientWidth`, not just visual inspection — the tab strip's
`overflow-x-auto` looked suspicious but was actually fine; a naive
DOM-scan of "elements wider than the viewport" produces false positives
for anything correctly clipped by an ancestor's `overflow-x`, so the
scan was restricted to elements with no scrolling ancestor):

- `ProfileHeader`'s Track/Compare/Export button row was
  `flex shrink-0` with no wrap — on mobile the three buttons together
  are wider than a 375px viewport, so the row pushed the entire page
  375px→440px wide instead of wrapping. Changed to `flex-wrap` on
  mobile, `flex-nowrap` from `sm:` up (unchanged desktop behavior).
- `ExportMenu`'s dropdown was `absolute right-0 w-56`, anchored to the
  export button's right edge. Once the button row above started
  wrapping, the button can sit near the left edge of a narrow screen,
  so a right-anchored 224px-wide menu extended off the left edge of the
  viewport, clipping every option's leading text (e.g. "Full profile —
  JSON" rendered as just "— JSON"). Changed to anchor `left-0` with a
  `max-w-[calc(100vw-2rem)]` cap below `sm:`, reverting to the original
  `right-0`/`w-56` at `sm:` and up where the button never sits near a
  screen edge.

## Scheduler: Vercel Cron, not a queue; in-app badge, not email

Asked how far to take spec §21's missing "check frequency" and
"notification channel" (`docs/TRACKING.md`/`docs/SAVED_SEARCHES.md` had
both flagged as missing since there's no job queue): Vercel Cron for the
scheduler (the deploy target, so no new infrastructure — no Redis, no
worker process, just `vercel.json` + one route) and in-app only for
notifications, explicitly declining real email since no email-sending
service is configured and a fake "email sent" flow that sends nothing
would be dishonest — the same "real-but-scoped, not simulated" theme as
everywhere else in this file. See `docs/SCHEDULER.md`.

**Found and fixed mid-slice: a drizzle-orm query-builder bug, not a data
bug.** `saved_searches inner join profiles` returned zero rows through
`.select().from().innerJoin()` on drizzle-orm 0.45.2 — but the exact SQL
text `.toSQL()` reported for that query, run directly via
`db.execute(sql\`...\`)`, returned the correct row every time. Isolated by
elimination: a brand-new (uncached) drizzle client, this query alone
with nothing else in the request, still empty — ruling out a caching or
ordering artifact in the app's own code, and narrowing it to the query
builder itself. `watchlist_entries inner join profiles` (structurally
identical, no enum column on the joined-from table) wasn't affected, but
`listProfilesNeedingCapture` (`src/lib/snapshot/scheduled-capture.ts`)
now reads both joins via raw `db.execute(sql\`...\`)` rather than leaving
one on the query builder and one worked around — one proven-correct code
path instead of two different ones.

**Update from writing this slice's integration tests
(`docs/TESTING.md`):** the same query-builder join, exercised fresh in
`scheduled-capture.integration.test.ts` against a brand-new vitest
process, returned the correct row — the failure didn't reproduce there.
The likely difference is the long-running `next dev` process the bug was
originally found in (many hot-reload cycles, a module-level cached `db`
client reused across requests) versus a short-lived one-shot process —
consistent with something connection/fetch-cache-state-dependent in
neon-http rather than a pure function of the query shape. Left the raw
`db.execute()` form in place regardless: it's proven correct in both
environments, whereas the query builder is only proven correct in one of
them.

## Production hardening: real integrations, opt-in, not simulated

Asked to take rate limiting/CSP/observability further (option 3 of a
multiple-choice question), the same "real-but-scoped" pattern as
`SOCIAL_PROVIDER=apify` applied again: distributed rate limiting
(`@upstash/ratelimit` + Upstash Redis) and error monitoring
(`@sentry/nextjs`) are both real SDK integrations that activate only
when their account's credentials are set (`UPSTASH_REDIS_REST_URL`/
`_TOKEN`, `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`); unconfigured, behavior
is byte-for-byte what it was before this slice. See
`docs/PRODUCTION_HARDENING.md` for what each does when it *is*
configured.

The Content Security Policy, by contrast, needed no account and no
"unconfigured" fallback — `docs/PRODUCTION_HARDENING.md` had previously
deferred it specifically because "this app has no third-party scripts...
today," reasoning that a CSP written now would either be trivial or need
rewriting the moment something real was added. Nothing was added since;
a search confirmed zero third-party scripts, zero inline event
handlers, zero iframes still hold, so the deferral's own stated
condition for writing a real CSP was already met — it just hadn't been
revisited. Wrote it as a per-request nonce'd `script-src` (Next's
documented middleware pattern) rather than a static `'unsafe-inline'`
policy, which would have covered the App Router's inline hydration
scripts but defeated most of a CSP's actual XSS protection.

**Found live: a root-level `middleware.ts` silently no-ops in a `src/`-
layout Next.js project.** The file compiled without error or warning,
but the CSP header never appeared on any response and `next dev` never
logged a `/middleware` compilation step at all — no error to point at
the cause. Moving the identical file to `src/middleware.ts` fixed it
immediately. Worth remembering for any future root-level Next.js
convention file in this project: check whether it belongs under `src/`
instead before assuming a more complex cause.
