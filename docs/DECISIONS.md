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
