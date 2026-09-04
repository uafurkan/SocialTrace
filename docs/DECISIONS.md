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
