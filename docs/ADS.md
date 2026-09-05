# Display ads (Ezoic)

Opt-in, same pattern as every other integration in this app
(`SOCIAL_PROVIDER`, `SENTRY_DSN`, ...): with `NEXT_PUBLIC_EZOIC_ENABLED`
unset or `false`, no script loads and no ad slot renders anywhere — the
app looks and behaves exactly as it did before this was added.

## What's wired up

- **`src/components/ads/ezoic-loader.tsx`** — loads Ezoic's standalone
  script (`sa.min.js`) once, in the root layout, only when
  `NEXT_PUBLIC_EZOIC_ENABLED=true`.
- **`src/components/ads/ad-slot.tsx`** (`<AdSlot placementId={N} />`) —
  one in-content placeholder. Renders the `ezoic-pub-ad-placeholder-{N}`
  div Ezoic's script looks for and pushes the `showAds(N)` call. Each
  `placementId` must match the number you assign to that position in the
  Ezoic dashboard's Ad Tester when you place it there.
- **Three placements, chosen to be non-intrusive on both mobile and
  desktop** (in normal document flow, no sticky/anchor/interstitial,
  reserved `min-height` so the ad loading in doesn't shift surrounding
  content, and a small "Advertisement" label above each so it's never
  mistaken for real content):
  - Home page (`101`) — below the hero and value cards, well past the
    search box so it never competes with the primary action.
  - Tools index (`102`) — below the full tool grid.
  - Profile page (`103`) — below every tab's content, at the very bottom
    of the profile layout, so it never interrupts a follower list or post
    grid mid-scroll.
- **`src/app/ads.txt/route.ts`** — serves `EZOIC_ADS_TXT` (pasted
  verbatim from the Ezoic dashboard's Ads.txt Manager) at `/ads.txt`.
  Unset → 404, rather than serving a guessed/placeholder file.
- **`src/middleware.ts`'s CSP** — `connect-src`/`frame-src` only widen to
  `https:` when `NEXT_PUBLIC_EZOIC_ENABLED=true`; the strict `'self'`-only
  baseline (`docs/PRODUCTION_HARDENING.md`) is unchanged with ads off.
  Ezoic's ad exchanges serve creatives from a large, non-enumerable set of
  ad-server domains — the same situation `img-src`'s `https:` allowance
  already handles for the real provider's avatar CDN.

## What you still have to do in the Ezoic dashboard (not code)

Two things this codebase cannot do for you, both one-time account setup:

1. **Add the site and get your real placement IDs.** Sign up at
   ezoic.com, add this domain, go through their Ad Tester placement flow,
   and it'll tell you which number to give each `<AdSlot placementId={N}>`
   above (the `101`/`102`/`103` here are placeholders — replace them to
   match what Ezoic assigns once you've placed them in their tool).
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
  content, and update the three `placementId`s to Ezoic's assigned
  numbers.
- Confirm `/ads.txt` serves the real content (not a 404).
- Load the home, tools, and a profile page and confirm the Ezoic script
  fires with no CSP violations in the browser console (the standard
  pattern this project already uses to verify anything CSP-adjacent —
  see the CSP nonce incident in `docs/DECISIONS.md`).
