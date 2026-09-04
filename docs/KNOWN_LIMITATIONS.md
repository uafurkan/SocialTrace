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
  except a same-process in-memory cache for pagination — there is no
  durable cache, no persistence to the Postgres schema yet, and no
  retry/backoff tuning beyond falling through to the next actor in the
  chain. The homepage box takes a full username or a profile link and
  makes exactly one lookup on submit — there is deliberately no
  search-as-you-type: a live suggestions box would mean a billed Apify
  call on every keystroke once the real provider is enabled — see
  `docs/SEARCH.md`.
- **No auth, billing, or accounts.** No login, no Stripe, no plans
  enforcement. The pricing page is static copy only.
- **Snapshot, diff, and tracking exist (synchronous, bounded,
  coverage-gated, and cookie-identified instead of accounts).**
  `/profile/[username]/history` lists real captured snapshots and can
  capture a new one on demand, `/profile/[username]/changes` lists the
  added/removed followers and changed profile fields detected
  automatically at capture time, and clicking "Track profile" adds a
  profile to the visitor's real `/tracking` dashboard — but all of it
  only when `DATABASE_URL` is set (falls back to "not available"
  otherwise). Each capture is bounded to 500 followers/following (see
  `docs/SNAPSHOTS.md`), membership diffing only runs when both sides of
  the comparison have ≥99.5% coverage (see `docs/DIFF.md`), and tracking
  identifies visitors by an anonymous cookie rather than a real account —
  no sign-in, no cross-device sync, no recovery if cookies are cleared
  (see `docs/TRACKING.md`). There's no scheduler, so tracked profiles'
  numbers only update when someone manually captures a new snapshot — no
  check frequency, notification channel, or change threshold config.
- **Follower comparison exists (spec §23), reusing the diff engine's
  coverage gate.** "Compare snapshots" on the profile header now links
  to a real `/profile/[username]/compare` page — pick any two snapshots
  and see who was gained/lost between them, computed on demand from the
  `memberships` table's history columns (no new table needed). Same
  ≥99.5%-coverage-on-both-sides rule as the automatic diff engine; below
  that it says so instead of guessing. See `docs/FOLLOWER_COMPARISON.md`.
- **Saved searches exist (spec §22), built on the comparison
  reconstruction above.** A "Save search" button on the Followers/
  Following pages saves a `(profile, dataset, query)` for the current
  anonymous visitor; the `/tracking` dashboard shows new/removed matching
  accounts between a profile's two most recent snapshots. No
  notifications — same missing notification channel as tracking, see
  `docs/SAVED_SEARCHES.md`.
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
- **SEO content pages exist for real features only (spec §45–§97).**
  `/help` (+ 7 articles), `/data-methodology`, `/changelog`, `/faq`, and
  three tool landing pages (`/tools/instagram-follower-history`,
  `/tools/instagram-follower-compare`, `/tools/instagram-growth-tracker`)
  are real content backed by real features, with WebSite/BreadcrumbList/
  Article/FAQPage JSON-LD. `robots.ts`/`sitemap.ts` list these plus the
  existing static pages; profile URLs stay excluded since they're backed
  by mock data by default. No blog, no OG image generation, no
  programmatic profile SEO, and no landing pages for the tools that
  don't have a real feature behind them yet — see `docs/SEO.md`.
- **Unit tests cover pure logic only (48 tests, Vitest — `npm test`).**
  Coverage math, the diff engine's coverage gate and membership
  reconciliation, saved-search matching, profile-link parsing, the rate
  limiter, and avatar/formatting helpers all have unit tests — see
  `docs/TESTING.md`. Nothing that touches the database (snapshot
  capture, tracking, saved searches end-to-end, every API route),
  components, or the Apify provider is automated yet; those were
  verified manually and live per feature (each doc's "Verified live"
  section).
- **No observability (Sentry/OpenTelemetry) or analytics.**
- **Rate limiting is in-process memory only, not distributed.**
  `src/lib/rate-limit.ts` protects the snapshot/export/track routes on a
  single server process, but a multi-instance serverless deployment
  (Vercel) can be bypassed by a caller fanning out across instances — see
  `docs/PRODUCTION_HARDENING.md`. No Content Security Policy, moderation,
  or abuse reporting either.

See spec §110 (Release Phases) and §228 (First 10 Engineering Milestones)
for the build order this session has been following: all 10 first
milestones have a slice now — real DB schema, provider contract for a
real data source, export, snapshot engine, diff engine, tracking/
watchlist (scoped to anonymous visitors, no auth), and production
hardening (error boundaries, security headers, health check, best-effort
rate limiting — SEO structured data/content pages deliberately excluded,
see `docs/PRODUCTION_HARDENING.md`). None of these are complete relative
to the full spec — each has its own docs file listing what was cut.
