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
- **OG image generation**. Static metadata only for now.
- **International SEO** (spec §116) — English only.
