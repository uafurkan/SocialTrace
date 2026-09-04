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
- **Real provider exists but is opt-in.** `src/lib/providers/apify/`
  implements `SocialDataProvider` against Apify actors for real Instagram
  data; the mock provider (`src/lib/providers/mock-provider.ts`) stays
  the default unless `SOCIAL_PROVIDER=apify` + `APIFY_API_TOKEN` are set,
  so nothing costs money by default. When enabled: follower/following
  lists are capped at 200 real users per profile per kind (Apify bills
  per result), reels come from a dedicated actor
  (`apify/instagram-reel-scraper`), and every request re-hits Apify
  except a same-process in-memory cache for pagination and search — there
  is no durable cache, no persistence to the Postgres schema yet, and no
  retry/backoff tuning beyond falling through to the next actor in the
  chain. Homepage username search is real (Instagram's own search via an
  Apify actor) but takes ~6-7s per lookup, so it's debounced rather than
  truly live — see `docs/PROVIDER_CONTRACT.md`.
- **No auth, billing, or accounts.** No login, no Stripe, no plans
  enforcement. The pricing page is static copy only.
- **Snapshot engine exists (synchronous, bounded); diff engine, tracking,
  and watchlists don't yet.** `/profile/[username]/history` lists real
  captured snapshots and can capture a new one on demand — but only when
  `DATABASE_URL` is set (falls back to "not available" otherwise), and
  each capture is bounded to 500 followers/following (see
  `docs/SNAPSHOTS.md`). "Track", "Compare", and "Changes" still render
  honest "not available" states or disabled buttons — no diff computation
  between two snapshots yet, and no watchlist/auth to "track" with.
- **Export exists but is synchronous and bounded, not a background-job
  pipeline.** The profile page's Export dropdown downloads JSON/XML (full
  profile bundle) or CSV (one resource at a time) directly from
  `/api/v1/profiles/[profileId]/export`, generated inside the request and
  capped at 500 items per list. No auth, no job queue, no blob storage, no
  signed/expiring URLs, no JSONL/ZIP/PDF formats — see `docs/EXPORT.md`.
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
