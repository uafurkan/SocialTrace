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
  (`apify/instagram-reel-scraper`), and there is no retry/backoff tuning
  beyond falling through to the next actor in the chain. A profile lookup
  (not follower/following lists) is now cached in Postgres for
  `PROFILE_CACHE_TTL_HOURS` (default 6 — see
  `src/lib/cache/profile-cache.ts`, `docs/DECISIONS.md`) when
  `DATABASE_URL` is set, so repeat searches for the same profile within
  that window don't re-bill Apify; without a database it still re-hits
  the provider every time. The homepage box takes a full username or a
  profile link and makes exactly one lookup on submit — there is
  deliberately no search-as-you-type: a live suggestions box would mean a
  billed Apify call on every keystroke once the real provider is enabled
  — see `docs/SEARCH.md`.
- **Accounts and plan limits exist; real billing does not.** Email +
  password sign-in/sign-up (`/login`, `/signup`, no OAuth, no magic
  links, no password reset — needs a real email service), and
  `users.plan` (free/pro) really gates tracked-profile and saved-search
  counts (free: 10 each) — see `docs/AUTH.md`, `docs/BILLING.md`. There
  is no Stripe or any other payment processor; `/account`'s "Upgrade" is
  a disabled button, and nothing can set a real account to `pro` except
  editing the database directly. The pricing page is still static copy
  only. Accounts are optional everywhere — tracking and saved searches
  work exactly as before for anonymous visitors; logging in only
  upgrades that scope from "this browser" to "this account" (same rows,
  no migration, see `docs/AUTH.md`'s identity resolution).
- **Snapshot, diff, and tracking exist (synchronous, bounded,
  coverage-gated, and cookie- or account-identified).**
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
  (see `docs/TRACKING.md`). A Vercel Cron job now recaptures tracked/
  saved-search profiles automatically once a day (see
  `docs/SCHEDULER.md`) — but only when deployed to Vercel with
  `CRON_SECRET` set; there's still no configurable check frequency or
  change-threshold, and the "notification" is an in-app nav badge, not
  email or push (no email-sending service is configured).
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
- **Stories, Highlights, Tagged posts, and post Likers/Comments are all
  real and anonymous (spec-honest) now — no login required for any of
  them.** `/profile/[username]/stories` shows real, currently-active
  public stories (`data-slayer/instagram-stories-scraper`,
  `src/lib/providers/apify/stories.ts`) — no pagination or archive, only
  what's active right now, since stories are inherently ephemeral (24h)
  and no actor was evaluated for past/archived ones.
  `/profile/[username]/highlights` shows real saved highlight reels and
  their contents (`seemuapps/instagram-highlights-scraper`,
  `src/lib/providers/apify/highlights.ts`) — no pagination.
  `/profile/[username]/tagged` shows real posts/reels the profile was
  tagged in by other accounts
  (`instagram-scraper/instagram-tagged-posts-scraper`,
  `src/lib/providers/apify/tagged-posts.ts`) — capped at 24 results, no
  pagination. Clicking a post/reel's like or comment count opens who
  liked it and what was said
  (`memo23/instagram-likers-scraper` + `apify/instagram-comment-scraper`,
  `src/lib/providers/apify/likers.ts` + `comments.ts`, exposed via
  `/api/v1/posts/engagement`) — capped at 50 likers / 30 comments per
  post, fetched on demand per post rather than eagerly for a whole grid.
  All four fall back to deterministic mock data with the mock provider.
- **Photos, videos, and reels can be downloaded, not just viewed.** The
  post/reel grid and the story viewer both have a Download action that
  proxies the real media file (`/api/v1/media/download`) with a forced
  attachment download, restricted to Instagram's CDN domains plus the
  mock provider's placeholder image host. No batch/zip download, no
  original (non-compressed) quality guarantee beyond whatever rendition
  the provider returned.
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
- **Unit tests (69, Vitest — `npm test`) cover pure logic; integration
  tests (`npm run test:integration`) now cover the real database.**
  Coverage math, the diff engine's coverage gate and membership
  reconciliation, saved-search matching, profile-link parsing, the rate
  limiter, and avatar/formatting helpers have unit tests; snapshot
  capture, tracking, saved searches, and auth/session now have real
  integration tests against the live Neon database (`docs/TESTING.md`).
  Components and the Apify provider are still verified manually
  (Playwright screenshots, live `curl` checks) rather than automated.
- **Sentry error monitoring exists, opt-in via `SENTRY_DSN`** — no
  analytics or OpenTelemetry.
- **Rate limiting is distributed when configured, in-process otherwise.**
  `src/lib/rate-limit.ts` uses real Upstash Redis
  (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) when set; without
  those, it's the original in-process counter, bypassable on a
  multi-instance serverless deployment (Vercel) by a caller fanning out
  across instances — see `docs/PRODUCTION_HARDENING.md`. A real Content
  Security Policy now exists (`src/middleware.ts`), and Sentry error
  monitoring is wired up opt-in via `SENTRY_DSN` — no moderation or abuse
  reporting yet.

See spec §110 (Release Phases) and §228 (First 10 Engineering Milestones)
for the build order this session has been following: all 10 first
milestones have a slice now — real DB schema, provider contract for a
real data source, export, snapshot engine, diff engine, tracking/
watchlist (scoped to anonymous visitors, no auth), and production
hardening (error boundaries, security headers, health check, best-effort
rate limiting — SEO structured data/content pages deliberately excluded,
see `docs/PRODUCTION_HARDENING.md`). None of these are complete relative
to the full spec — each has its own docs file listing what was cut.
