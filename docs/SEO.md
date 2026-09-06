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
  **`/tools/instagram-growth-tracker`**,
  **`/tools/instagram-story-viewer`**,
  **`/tools/anonymous-instagram-viewer`** (spec §46/§92) — five tool
  landing pages that each map to a real, working feature in this build
  (History tab, Compare snapshots view, `/tracking` dashboard, the
  Stories tab, and the profile viewer as a whole). The other tools
  listed in `/tools` stay honestly labeled "Coming soon" since no
  dedicated actor/feature backs them yet.

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
- **The other tool landing pages** listed in `/tools` (profile analyzer,
  follower/following checker, following compare, username/bio history,
  engagement calculator, competitor analyzer). Each requires the
  underlying feature to exist — none do yet, so a landing page for any
  of them would be a scaled-content page in the exact sense §45 forbids.
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

## "Insta anon" / "story viewer anon" search intent — two real landing pages, not a doorway page

Asked to rank for queries like "insta anon," "anon insta," "insta story
viewer anon," and "anon story viewer." Unlike the misspelled-query
doorway-page request declined earlier in this file, this is legitimate:
anonymous, no-login viewing of public Instagram content is this app's
actual core feature, not an unrelated query being targeted for traffic.
Added two real tool landing pages following the exact pattern of the
three that already existed (`ToolLanding` component, breadcrumb + FAQ
JSON-LD, `alternates.canonical`):

- **`/tools/instagram-story-viewer`** — targets the story-viewer-specific
  cluster ("story viewer anon," "anon story," "insta story viewer
  anonymous"). Maps to the real Stories tab
  (`data-slayer/instagram-stories-scraper`, already shipped).
- **`/tools/anonymous-instagram-viewer`** — targets the broader cluster
  ("insta anon," "anon insta," "view instagram anonymously"). Describes
  the app's full anonymous browsing surface: posts, reels, stories,
  highlights, tagged posts, and per-post likers/comments.

Both are substantive, distinct pages (different lead copy, different
`howItWorks`, different FAQ — not the same content repeated under a
different URL), each honestly states what it can't do (private accounts,
no archive of expired stories, capped follower/following coverage), and
neither exists to funnel traffic to unrelated content — the page's
subject and the feature behind it are the same thing. `/tools/page.tsx`
promoted "Story viewer" from "Coming soon" to a real link (it had been
marked coming soon before the Stories feature shipped, and was never
revisited) and repurposed the placeholder "Profile viewer" card into the
new "Anonymous viewer" page. Both routes are in `src/app/sitemap.ts`.

## Real domain: www.socialtrace.co

The placeholder `socialtrace.example.com` used throughout (metadataBase,
sitemap, robots.txt, JSON-LD `SITE_URL`) is now the real domain,
`https://www.socialtrace.co`. Canonical URLs, Open Graph URLs, the
sitemap's URLs, and `robots.ts`'s sitemap pointer all reflect this.

## `/transcribe/*` — the transcriber's version of the accepted search-intent pattern

Four real landing pages (`/transcribe/youtube-transcript-generator`,
`-tiktok-video-to-text`, `-instagram-reel-to-text`,
`-facebook-video-to-text`), each with genuinely different lead copy,
`howItWorks`, and FAQ, CTA-ing into the real feature at `/transcribe` —
the same pattern as the "Insta anon" / "story viewer anon" pages above,
applied to the video-transcriber product surface. See docs/TRANSCRIBER.md
for why the homepage itself does not vary by keyword (both a technical
impossibility for organic search, and something this project already
decided against even where the data is available).

Not done here (Vercel dashboard, not code): actually attaching
`socialtrace.co`/`www.socialtrace.co` to the Vercel project and choosing
which of the two is canonical, with the other 301-redirecting to it —
Vercel's Domains settings do this for you once both are added. Without
that redirect, the apex (`socialtrace.co`) and `www` host serving the
same content as two separate URLs would work against the canonical tags
already in place rather than reinforcing them.

## Site-wide polish pass: the OG-inheritance bug, noindex on private pages, sitemap tiers

A full technical-SEO audit of every page found one real bug and a few
gaps, ahead of submitting the sitemap to Search Console/Bing Webmaster
Tools/Yandex Webmaster:

- **Every non-home page was sharing the homepage's social-preview copy.**
  Next.js's App Router metadata does *not* recompute a parent layout's
  `openGraph`/`twitter` fields from a child page's own `title`/
  `description` — only fields the child explicitly sets override the
  parent's. The root layout (`src/app/layout.tsx`) sets a real
  `openGraph`/`twitter` block for the homepage; every other page only
  ever set `title`/`description`/`alternates.canonical`, so linking
  `/pricing`, `/faq`, `/tools/instagram-story-viewer`, any `/transcribe/*`
  page, etc. on Twitter/Slack/Discord/iMessage rendered the *homepage's*
  preview card, not that page's own. Fixed by adding
  `src/lib/seo/metadata.ts`'s `pageMetadata()` — one helper every page
  now calls that fills in `openGraph`+`twitter` from the same
  `title`/`description` it already has — applied to every `page.tsx` and
  the two dynamic `generateMetadata()` call sites (`profile/[username]/
  layout.tsx`, `help/[slug]/page.tsx`).
- **`/account`, `/login`, `/signup`, `/tracking` now carry `robots:
  {index: false, follow: true}`** (via `pageMetadata()`'s `noIndex`
  option) instead of relying on `robots.ts`'s `disallow` list.
  `/tracking` used to be in that disallow list; it's been removed,
  because a `disallow`'d URL is never crawled at all — a crawler can't
  see a `noindex` meta tag on a page it's blocked from fetching, so a
  disallowed-but-linked URL can still surface in search results as a
  bare, snippet-less entry ("no information is available for this
  page"). A crawlable `noindex` page is the correct way to keep
  personalized/no-content pages out of the index without that side
  effect. Only `/api/` stays in `robots.ts`'s `disallow` — it's not a
  page a `noindex` tag could attach to.
- **`/tools` and `/pricing` had generic, thin descriptions** (`"SocialTrace
  public profile tools."`) — `/tools`'s description now names the five
  real tools behind it instead of describing nothing.
- **`sitemap.ts` listed every URL at the same implicit priority with no
  `changeFrequency`.** Reworked into explicit tiers matching the site's
  real IA: homepage (1.0, daily) > the two product hubs `/tools` and
  `/transcribe` (0.9, weekly) > their nine search-intent landing pages
  (0.7, monthly) > `/pricing` (0.6, monthly) > help/FAQ/methodology (0.5)
  > changelog (0.4, weekly — changes often but isn't a landing page) >
  legal (0.2, yearly). These are hints engines are free to ignore, but a
  flat sitemap gave them no signal at all.

**Not done here, deliberately** — a real content/compliance issue found
during this pass, not a metadata one: `/privacy` and `/terms` still say
"this build is a product scaffold using generated sample data — no real
profile data is collected" from before the Apify provider went live.
That's no longer accurate (`SOCIAL_PROVIDER=apify` is the production
provider) and legal-page copy is a substantive content decision, not a
mechanical SEO fix — flagged for the site owner to rewrite deliberately
rather than silently edited here.

**Also not done here** — the actual one-time submission steps
(`GOOGLE_SITE_VERIFICATION`/`BING_SITE_VERIFICATION`/
`YANDEX_SITE_VERIFICATION` env vars, then adding+verifying the property
and submitting `https://www.socialtrace.co/sitemap.xml` in each of
Google Search Console, Bing Webmaster Tools, and Yandex Webmaster) —
these require the account owner's own login to each console; the code
side (the verification `<meta>` tags, `robots.ts`'s `sitemap` pointer)
was already in place before this pass and needed no changes.
