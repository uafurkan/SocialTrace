# SEO Content Slice

Spec §45–§57, §92–§96, §176. What this build ships as indexable content,
and — importantly — what it deliberately does not ship, to avoid the
scaled-content / doorway-page anti-patterns the spec itself calls out
(§45, §57).

## Pages

- **`/help`** and **`/help/[slug]`** (spec §96) — help center index plus
  seven real articles (`src/lib/seo/help-articles.ts`) covering every
  feature this build actually has: getting started, snapshots, coverage,
  tracking, comparisons, saved searches, exports. No stub articles for
  features that don't exist — the index shows what's real.
- **`/data-methodology`** (spec §97) — single, honest page explaining
  what we collect, how, and what coverage means, plus a plain list of
  what this build doesn't do (no sign-in, scheduler, notifications,
  stories/highlights).
- **`/changelog`** (spec §95) — one entry per shipped milestone in this
  branch, dated and highlighted. Real history of what shipped.
- **`/faq`** (spec §93) — seven answers to the exact questions the spec
  seeded the FAQ with, plus FAQPage JSON-LD.
- **`/tools/instagram-follower-history`**,
  **`/tools/instagram-follower-compare`**,
  **`/tools/instagram-growth-tracker`** (spec §46/§92) — three tool
  landing pages that each map to a real, working feature in this build
  (History tab, Compare snapshots view, `/tracking` dashboard). The
  other tools listed in `/tools` stay honestly labeled "Coming soon"
  since no dedicated actor/feature backs them yet.

## Structured data (spec §53)

`src/lib/seo/json-ld.tsx` centralizes JSON-LD generation with a shared
`<JsonLd>` component. All values pass through `JSON.stringify` and every
`<` is escaped to `<` before injection — the escaping the Next.js
JSON-LD guide explicitly warns about (§53 references it).

- `WebSite` on the home page.
- `BreadcrumbList` on `/help`, `/help/[slug]`, `/data-methodology`,
  `/changelog`, `/faq`, and each tool landing page.
- `Article` on `/help/[slug]` and `/data-methodology`.
- `FAQPage` on `/faq` and each tool landing page's FAQ section.

No `Organization` markup with fabricated contact info, no `Product`
markup with fake pricing, no `Review`/`AggregateRating` — the spec is
explicit that structured data must accurately describe the page (§53
"Do not fabricate structured data"), so anything we don't have real
data for is not marked up.

## Sitemap and robots

`src/app/sitemap.ts` lists the static routes plus every help article
slug. Per-profile URLs remain intentionally excluded because profile
pages are backed by the mock provider by default; sitemapping them
would advertise sample URLs.

`src/app/robots.ts` disallows `/api/` and `/tracking` (the tracking
dashboard is keyed on an anonymous browser cookie — indexing it makes
no sense).

## Deliberately not in this slice

- **Blog** (spec §94). Blog content is a real-content commitment that
  cannot be fabricated ("massive blog farm" is the anti-pattern spec
  §125 warns against). The channel exists in the changelog but blog
  posts themselves are a human authorship decision, not a build task.
- **Programmatic profile SEO** (spec §47). Profile pages remain
  excluded from the sitemap until they are backed by real, resolved
  Instagram profiles with a coverage floor high enough to satisfy the
  usefulness threshold spec §47 describes.
- **The other 10 tool landing pages** listed in `/tools`. Each one
  requires the underlying feature to exist. Story viewer, bio history,
  username history, engagement calculator, etc. have no real feature
  behind them yet — a landing page would be a scaled-content page in
  the exact sense §45 forbids.
- **International SEO** (spec §116) — English only.

## Multi-engine technical SEO (Google, Bing, Yandex)

Added to make the site properly indexable and shareable, not just by
Google:

- `src/app/opengraph-image.png` (Next.js's file-convention for the App
  Router) — a real, branded 1200×630 image (logo + tagline), auto-wired
  by Next.js into both `og:image` and `twitter:image` on every page that
  doesn't set its own. Closes the "OG image generation" gap noted above.
- `src/app/layout.tsx`'s root `metadata` gained `openGraph`, `twitter`
  (`summary_large_image`), and `alternates.canonical` — real values
  (site name, real description, real URL), not fabricated engagement
  numbers or claims.
- `verification` (Google Search Console, Bing Webmaster Tools, Yandex
  Webmaster) renders each engine's ownership `<meta>` tag only when its
  token is set (`GOOGLE_SITE_VERIFICATION`/`BING_SITE_VERIFICATION`/
  `YANDEX_SITE_VERIFICATION` — see `.env.example`), the same opt-in
  pattern as `SENTRY_DSN`/`SOCIAL_PROVIDER`. Unset, nothing renders.
  Actually submitting the sitemap in each console/tool is a one-time
  manual step for whoever owns those accounts — this only adds the
  capability to prove ownership once they do.
- `organizationJsonLd()` (`src/lib/seo/json-ld.tsx`) — real, minimal
  `Organization` markup (name, url, logo) on the home page, following
  the same "no fabricated data" rule as every other JSON-LD helper here.

None of this needs a real Instagram data provider to be legitimate — it
describes the site itself, which is real regardless of `SOCIAL_PROVIDER`.

## Declined: a "doorway page" for misspelled search queries

Asked to build a page that would target a wide net of misspelled/typo
search queries so it ranks in Google/Bing/Yandex/Yahoo, and redirect
whoever lands on it into the app — declined, not implemented. This is a
doorway page by definition (a page whose only purpose is to rank for
queries it doesn't meaningfully answer, then funnel the visitor
elsewhere), which:

- **Directly contradicts a decision this project already made twice**
  (this file's "Deliberately not in this slice" section, and
  `docs/KNOWN_LIMITATIONS.md`'s "avoids the doorway-page anti-pattern"
  note on `/tools`) — spec §45/§57 call this out by name as the thing to
  avoid, and the whole SEO slice was built around only shipping pages
  with real content behind them.
- **Violates every named engine's own guidelines** — Google's spam
  policies, Bing Webmaster Guidelines, and Yandex's webmaster
  requirements all define doorway/gateway pages as manipulative and
  grounds for a manual action or de-indexing, which risks the *entire*
  site's search visibility, not just the fake page's.
- **Doesn't actually work as pitched.** A single ghost page cannot
  simultaneously rank for "all typo variants" of arbitrary queries —
  search engines rank pages for what they're actually about, and stuffing
  keyword variants onto a page you plan to redirect people away from
  reads as spam to a crawler, not as topical relevance.

What legitimate typo-handling already exists and was left as-is:
`src/app/not-found.tsx` gives anyone who lands on a broken/mistyped URL
a real search box and a link home rather than a dead end, and
`extractUsername()` (`src/lib/profile-link.ts`) already tolerates an `@`
prefix and both bare-username and full-profile-URL input. If there's a
specific, real point of confusion (e.g. people misspelling the site's
own name), the honest fix is a real redirect from that exact known
misspelling to the real page — not a page built to rank for many queries
it isn't really about.

## Brand-misspelling redirects (not a doorway page)

`next.config.mjs`'s `redirects()` sends known misspellings of the brand
name landing as a path on this domain — `/socialtrce`, `/sosyaltrace`,
`/social-trace`, etc. — to `/` with a real 301. This is narrowly scoped
to the site's own name, unlike the declined doorway-page request above:
there's no content built to rank for unrelated queries, no keyword
stuffing, and both the redirect source and destination obviously refer
to the same real site — a legitimate typo-correction, the same category
as a browser's own "did you mean" for a mistyped domain.
