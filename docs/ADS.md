# Display ads (Ezoic + Google AdSense)

Opt-in, same pattern as every other integration in this app
(`SOCIAL_PROVIDER`, `SENTRY_DSN`, ...): with both `NEXT_PUBLIC_EZOIC_ENABLED`
and `NEXT_PUBLIC_ADSENSE_ENABLED` unset or `false`, no script loads and no
ad slot renders anywhere — the app looks and behaves exactly as it did
before this was added.

Two networks are wired up as **alternatives, not a combination**: Ezoic
requires 250,000 active users/month for standard approval (or its
Incubator Program below that), so AdSense is the parallel path while that
review is pending. `<AdSlot>` always prefers Ezoic when both are enabled —
the two are never shown in the same slot at once, since every ad network's
terms prohibit exactly that.

## What's wired up

- **`src/components/ads/ezoic-loader.tsx`** — loads Ezoic's full official
  header script set, in order (Ezoic's "Site Integration" docs), once in
  the root layout, only when `NEXT_PUBLIC_EZOIC_ENABLED=true`: the two
  consent/privacy scripts (`cmp.gatekeeperconsent.com`,
  `the.gatekeeperconsent.com`), the `ezstandalone` init snippet, the
  standalone ad script (`sa.min.js`), then `ezoicanalytics.com/analytics.js`.
- **`src/components/ads/ad-slot.tsx`** (`<AdSlot placementId={N} />`) —
  one placeholder. Renders the `ezoic-pub-ad-placeholder-{N}` div Ezoic's
  script looks for and pushes the `showAds(N)` call. Each `placementId`
  must match the number you assign to that position in the Ezoic
  dashboard's Ad Tester when you place it there. Takes an optional
  `compact` prop for a flush, 50px-min-height strip with no card chrome or
  "Advertisement" label spacing — used only by the mobile anchor bar below,
  where the full in-content treatment would be too tall for a fixed strip.
- **In-flow placements** across every real content page on the site, each
  reserved `min-height` so the ad loading in doesn't shift surrounding
  content, and a small "Advertisement" label above each so it's never
  mistaken for real content:
  - Home page, search area (`100`) — directly below the search form and
    its helper text, not overlapping the input or submit button.
  - Tools index (`102`) — below the full tool grid.
  - Profile page, results area (`103`) — below every tab's content, at
    the very bottom of the profile layout (all three platforms — Instagram,
    TikTok, Facebook — share this placement id), so it never interrupts a
    follower list or post grid mid-scroll.
  - Tool landing pages and the transcriber hub/platform pages (`105`
    mid-page, between the tool itself and Limitations; `106` near the
    bottom, between FAQ and Related tools) — these are the site's highest
    organic-search-intent pages (anonymous viewers, follower tools, each
    `/transcribe/*` page), so they get two well-spaced slots instead of
    one: research on AdSense/Ezoic placement consistently finds ads
    embedded within content outperform a single end-of-page unit, without
    the density that trips "too many ads" quality signals.
  - Help index (`107`, bottom), help articles (`108`, mid-article — split
    at the article's paragraph midpoint, but only once there are at least
    four paragraphs so the ad never sits one sentence into a short
    article), FAQ (`109`, mid-list, splitting the questions into two `<dl>`
    blocks), changelog (`110`, bottom), data methodology (`111`, bottom) —
    long-form/reference content pages that a search visitor actually reads
    rather than bounces off, which is exactly where in-content placement
    pays off most.
  - Deliberately **not** placed on `/login`, `/signup`, `/account`,
    `/pricing`, `/privacy`, `/terms`, or `/tracking` — a conversion,
    auth, legal, or personal-dashboard page is the wrong place for an ad
    both by UX judgment and by each network's own guidance to keep ads
    off checkout/account flows.
- **A mobile-only sticky anchor bar** (`src/components/ads/anchor-ad-slot.tsx`,
  placement `101`) fixed to the bottom of the viewport on every page,
  `sm:hidden` (desktop has no anchor bar — the format exists specifically
  because mobile has no sidebar to hold a persistent unit in). Both
  networks document this as one of the single highest-RPM formats they
  offer, since it stays in view through the whole scroll instead of being
  seen once and scrolled past. Built as its own component rather than a
  network auto-anchor toggle so it can guarantee what both networks'
  policies require for this format: a real, always-visible close button
  (never covering it with the ad itself), and a slim fixed height (`AdSlot`'s
  new `compact` prop — a 50px strip with no card chrome) so it never
  swallows a meaningful fraction of a phone screen. Dismissal is
  `sessionStorage`-scoped: closing it once hides it for the rest of that
  tab's session without needing to ask again, but a fresh visit later
  still gets the chance to show it once. `z-40`, below every modal in the
  app (`z-50`), so it never sits on top of the ad-gate, the story/highlight
  lightboxes, or the post-engagement modal.
- **A click-to-continue ad gate** (`src/components/ads/ad-gate.tsx`,
  placement `104`) between submitting a search and landing on the profile
  result — a real modal with an ad slot and a "Continue" button that only
  enables after a few seconds, never an auto-redirect and never a button
  that overlaps the ad itself (avoids accidental/invalid ad clicks, which
  every ad network's terms prohibit). Gated per username, once per
  30-minute session window (`sessionStorage`) — re-searching the same
  profile, or switching tabs once you're already on it (including
  Stories), never re-triggers it. Off unless
  `NEXT_PUBLIC_AD_GATE_ENABLED=true` **and** ads are enabled; with either
  unset, search navigates straight through as before.
- **`src/app/ads.txt/route.ts`** — 301-redirects `/ads.txt` to
  `EZOIC_ADS_TXT_URL` (the exact URL Ezoic's dashboard gives you in its
  "Ads.txt Setup" step, e.g. `https://srv.adstxtmanager.com/19390/socialtrace.co`)
  — the officially recommended non-WordPress integration, so Ezoic's
  authorized-sellers list stays live-updated instead of a static
  snapshot going stale. Unset → 404, rather than guessing a URL.
- **`src/middleware.ts`'s CSP** — `connect-src`/`frame-src` only widen to
  `https:` when `NEXT_PUBLIC_EZOIC_ENABLED=true`; the strict `'self'`-only
  baseline (`docs/PRODUCTION_HARDENING.md`) is unchanged with ads off.
  Ezoic's ad exchanges serve creatives from a large, non-enumerable set of
  ad-server domains — the same situation `img-src`'s `https:` allowance
  already handles for the real provider's avatar CDN.

### Why these positions (research notes)

Placement choices above follow the same two, consistently-repeated
findings across Google's own AdSense guidance and Ezoic's publisher
literature (see sources below):

1. **In-content beats end-of-page.** An ad embedded inside real content —
   between paragraphs, between sections — gets more genuine viewable
   impressions than one unit stacked at the very bottom, because most
   visitors on a long page never scroll that far. That's why every
   long-form page here (help articles, tool landing pages, FAQ) gets a
   mid-content slot, not just a bottom one.
2. **Anchor units are a top-RPM format precisely because of dwell time.**
   A fixed bottom bar earns for the visitor's entire time on the page,
   not just the moment they scroll past a fixed slot — both networks
   name it as one of the highest-earning single placements they offer.
   The tradeoff (permanent screen real estate) is why it's mobile-only,
   slim, and dismissible here rather than sitewide and undismissable.

Sources: [Google AdSense — Best practices for ad
placement](https://support.google.com/adsense/answer/1282097),
[AdSense start guide — best
practices](https://adsense.google.com/start/resources/best-practices-for-google-adsense/),
[Ezoic — Q4 website optimization
strategies](https://www.ezoic.com/blog/q4-website-optimization-strategies-how-publishers-can-maximize-revenue-in-peak-season).

## Google AdSense (parallel path)

- **`src/components/ads/adsense-loader.tsx`** — loads
  `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<id>` in
  `<head>` via `NEXT_PUBLIC_ADSENSE_CLIENT_ID` alone (independent of the
  enabled flag) — this is Google's site-ownership verification
  requirement ("paste this script into every page's `<head>`"), so it has
  to render before the account is even approved.
- **`src/components/ads/ad-slot.tsx`** — once verified and
  `NEXT_PUBLIC_ADSENSE_ENABLED=true`, the same `<AdSlot placementId={N}>`
  calls used for Ezoic render a real `<ins class="adsbygoogle">` unit
  instead, using whichever `NEXT_PUBLIC_ADSENSE_SLOT_<N>` env var matches
  that placement id (see the full list in `.env.example`) — a placement
  with no slot id configured just stays empty, same fail-closed pattern as
  everything else here.
- **`src/app/ads.txt/route.ts`** — when `EZOIC_ADS_TXT_URL` isn't set, this
  now serves AdSense's authorized-sellers line directly
  (`google.com, pub-<id>, DIRECT, f08c47fec0942fa0`, Google's own
  documented static format) derived from `NEXT_PUBLIC_ADSENSE_CLIENT_ID`,
  instead of just 404ing.
- **CSP (`src/proxy.ts`)** — `frame-src`/`connect-src` widen to `https:`
  when `NEXT_PUBLIC_ADSENSE_ENABLED=true`, the same non-enumerable
  ad-server-domain situation Ezoic already gets. `script-src` also gains
  `'unsafe-eval'` when either ad network is enabled — Ezoic's consent/
  analytics.js was observed in production `eval()`-ing a string for its
  country-based consent check, which `'strict-dynamic'` doesn't cover
  (it only propagates to child `<script>` elements, not `eval`/`new
  Function`); without it the script threw and consent/analytics silently
  broke. Stays off entirely with ads disabled.

### AdSense setup steps (not code)

1. Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-<your id>` and deploy —
   this alone makes the verification script appear in `<head>`.
2. In the AdSense dashboard, submit the site for review using the "code
   snippet already placed" verification method.
3. Once approved, create an ad unit per placement you want live, put each
   unit's slot id into the matching `NEXT_PUBLIC_ADSENSE_SLOT_<N>` env
   var, and set `NEXT_PUBLIC_ADSENSE_ENABLED=true`.
4. AdSense's own dashboard has the same content-category exclusion
   requirement as Ezoic below (Settings → Ad blocking controls) — set it
   before going live.

## What you still have to do in the Ezoic dashboard (not code)

Two things this codebase cannot do for you, both one-time account setup:

1. **Add the site and get your real placement IDs.** Sign up at
   ezoic.com (note: Ezoic requires 250,000 active users/month for regular
   approval — a new site needs their Incubator Program or an alternate ad
   network until it clears that threshold), add this domain, go through
   their Ad Tester placement flow, and it'll tell you which number to give
   each `<AdSlot placementId={N}>` above (every id listed in `.env.example`
   — `100`–`111` — is a placeholder; replace each with what Ezoic assigns
   once you've placed that position in their tool). Also set
   `EZOIC_ADS_TXT_URL` to the exact redirect URL their "Ads.txt Setup" step
   gives you.
2. **Content-category exclusion (+18 / adult, gambling).** This is a
   publisher-level setting in Ezoic's own dashboard — Settings → Privacy
   & Compliance (or Monetization → Ad Tester → "Blocked Categories",
   Ezoic's menu naming shifts over time) — where you check the IAB
   categories to exclude, at minimum **Adult Content** and **Gambling**.
   This genuinely cannot be done from this app's code: which creative
   fills a slot is chosen by Ezoic's real-time ad exchange and rendered
   inside a cross-origin iframe our JavaScript has no access to inspect
   or filter (and attempting to would violate every ad network's terms of
   service anyway) — category exclusion is a request sent to the ad
   exchange ahead of time, and only the publisher dashboard can make that
   request. Turning this on in the dashboard is a required step before
   going live, not optional polish.

## Verification once you have a real Ezoic account

- Set `NEXT_PUBLIC_EZOIC_ENABLED=true`, paste the real `EZOIC_ADS_TXT`
  content, and update every `placementId` to Ezoic's assigned numbers.
- Confirm `/ads.txt` serves the real content (not a 404).
- Load the home page, a tool landing page, a help article, the FAQ page,
  and a profile page on both desktop and mobile; confirm the Ezoic script
  fires with no CSP violations in the browser console (the standard
  pattern this project already uses to verify anything CSP-adjacent — see
  the CSP nonce incident in `docs/DECISIONS.md`), and confirm the mobile
  anchor bar appears above the fold-free zone at the bottom of the screen,
  never covering the header/footer nav or a tap target, and that its close
  button actually dismisses it for the rest of that tab's session.
