# Architecture

Governing spec: `SOCIALTRACE_MASTER_BUILD_SPEC.md`. This document
describes what is actually implemented in this build; see
`docs/KNOWN_LIMITATIONS.md` for what isn't.

## Layering (spec §1.3)

```
Provider Adapter (SocialDataProvider interface)
      ↓
Mock Provider (deterministic fake data — no real provider yet)
      ↓
Canonical Domain Types (src/lib/domain/types.ts)
      ↓
Next.js Route Handlers (/api/v1/profiles/{id}/followers|following)
      ↓
Server Components (profile pages) / Client Components (search, virtualized lists)
```

Nothing above the "Mock Provider" line knows or cares that the data is
fake. Swapping providers is a one-file change (`src/lib/providers/index.ts`).

## Directory structure

```
src/
  app/                      Next.js App Router routes
    profile/[username]/     Profile shell (layout) + tabs (pages)
    api/v1/profiles/[id]/   Route handlers backed by the provider
    tools/ pricing/ api/ privacy/ terms/
    robots.ts sitemap.ts
  components/
    ui/                     Design-system primitives (button, badge, input, card, tabs)
    layout/                 Header, footer, logo
    home/                   Landing page pieces
    profile/                Profile header, tabs, coverage badge, post grid
    followers/              Search + virtualized member list, dataset header
  lib/
    domain/types.ts         Canonical models (Profile, SocialUser, Post, CoverageStatus)
    providers/              SocialDataProvider interface + mock implementation
    server/profile.ts       Cached per-request profile lookup + notFound() helper
    copy.ts                 Centralized English copy (spec §1.7)
    utils.ts                cn(), formatCount(), formatRelativeTime()
  styles/tokens.css         Design tokens (spec §7.2)
```

## Why a Route Handler layer exists with no real backend

`/api/v1/profiles/{id}/followers` and `.../following` proxy directly to
the mock provider, but they exist as real HTTP endpoints (not a function
call from the page) so that:

1. The client-side `MemberList` component never receives the whole
   dataset — it calls the endpoint with `cursor`/`q`, matching the real
   contract in spec §12/§30 (server-side search, cursor pagination).
2. Introducing a real backend later means pointing this same route at a
   real service/DB query instead of the in-process mock — the frontend
   contract doesn't change.

## Data honesty (spec §1.2)

`CoverageBadge` (`src/components/profile/coverage-badge.tsx`) is the only
place that renders indexed/total/coverage numbers. Every surface that
shows a dataset (profile header, followers page, following page) goes
through it, and partial coverage always triggers the explicit partial-data
notice (`DatasetHeader`) rather than silently truncating results.

## What's deliberately not built yet

See `docs/KNOWN_LIMITATIONS.md` and `docs/DECISIONS.md`.
