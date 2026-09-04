# Known Limitations

This build is the **frontend scaffold + design system** slice only (see
`docs/DECISIONS.md`). It is not production-ready and does not implement
most of `SOCIALTRACE_MASTER_BUILD_SPEC.md`. Explicitly out of scope:

- **Database schema exists, nothing is wired up.** `src/lib/db/schema.ts`
  defines the Postgres tables (Drizzle ORM) and `drizzle/` holds the
  generated migrations (see `docs/DATABASE.md`), but no provider writes
  to them and no app code reads from them — `src/lib/providers/mock-provider.ts`
  still serves the UI directly. No seed script, no live database
  connected in this session.
- **No real data provider.** `src/lib/providers/mock-provider.ts` returns
  deterministic fake data. No Instagram or other platform integration
  exists. Follower/following datasets are capped at 5,000 generated users
  in memory per profile, regardless of the fake `followerCount`.
- **No auth, billing, or accounts.** No login, no Stripe, no plans
  enforcement. The pricing page is static copy only.
- **No snapshot/diff engine, tracking, or watchlists.** The "Track",
  "Compare", "History", and "Changes" surfaces render honest "not
  available" states or disabled buttons rather than fake data.
- **No export system.** The Export button is disabled; no XML/JSON/CSV
  generation, no background jobs, no signed URLs.
- **No Stories or Highlights data** — the mock provider's capability flags
  mark these `false`, and those tabs render "not available in this
  build."
- **No job queue, Redis, or background workers.**
- **No structured data (JSON-LD), OG image generation, or blog/help/
  changelog content.** `robots.ts`/`sitemap.ts` only list the static pages
  that actually exist; profile URLs are intentionally excluded from the
  sitemap since they're backed by mock data, not real public profiles.
- **No automated tests yet.** Verification for this slice was manual
  (dev server + build/lint).
- **No observability (Sentry/OpenTelemetry) or analytics.**

See spec §110 (Release Phases) and §228 (First 10 Engineering Milestones)
for what a Phase 2+ session should pick up next: real DB schema, provider
contract for a real data source, snapshot engine, diff engine, and
tracking persistence, in that order.
