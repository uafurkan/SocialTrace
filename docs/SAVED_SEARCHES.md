# Saved Searches

Spec §22. "A powerful retention feature" — save a search over a
profile's followers/following, and on a future snapshot see how many
matching accounts were gained or lost, per spec's own example:

```
Saved search
Profile: @nike
Dataset: Followers
Query: alex

On future snapshots:
3 new matching accounts
1 removed matching account
```

## What's implemented

- **Built entirely on the follower comparison reconstruction
  (`docs/FOLLOWER_COMPARISON.md`), not a separate mechanism.** A saved
  search's "new/removed matching accounts" is exactly
  `compareSnapshots`'s `newMembers`/`removedMembers` between a profile's
  two most recent snapshots, filtered by the saved query string against
  username/display name (`src/lib/tracking/saved-searches.ts`). Same
  ≥99.5%-coverage-on-both-sides gate applies — a saved search on a
  low-coverage profile honestly says "comparison unavailable" instead of
  a number, same as everywhere else this rule (spec §20) applies.
- **"Save search" button** on the Followers/Following pages
  (`src/components/followers/member-list.tsx`) — appears next to the
  search box once you've typed something and a database is configured.
  Saves `(profile, kind, query)` for the current visitor — the same
  cookie-or-account identity as tracking (`docs/TRACKING.md`,
  `docs/AUTH.md`); saving while signed in makes it follow the account
  across devices, capped by the plan's saved-search limit
  (`docs/BILLING.md`, free: 10).
- **`GET/POST /api/v1/saved-searches`** (list / create) and
  **`DELETE /api/v1/saved-searches/[id]`** — list, save, and remove.
- **The `/tracking` dashboard** now has a "Saved searches" section below
  tracked profiles, showing each search's new (green) / removed (red)
  matches, or an honest "capture one more snapshot" / "comparison
  unavailable" message when there isn't enough history yet.

## Scope decisions

**Plain substring match, not a structured query language.** Spec §22's
own example (`Query: alex`) is a bare string, matching how the existing
follower/following search box already works
(`src/components/followers/member-list.tsx`'s client-side + server
route filtering) — a saved search reuses that same mental model rather
than inventing filter syntax.

**No email/push notification when a match changes.** Spec §21's
"Tracking configuration" (notification channel) applies here too — no
email-sending service is configured (`docs/SCHEDULER.md`). There is a
small in-app badge next to the "Track" nav link showing a live count of
new/removed matches plus tracked-profile changes, and a scheduled job
now recaptures profiles automatically (`docs/SCHEDULER.md`) so that
count can change without you visiting a profile yourself — but seeing
it still requires being on the site; nothing reaches you outside it.

**Comparison is always "latest two snapshots," not a chosen pair.**
Unlike `/profile/[username]/compare` (`docs/FOLLOWER_COMPARISON.md`),
which lets you pick *which* two snapshots to compare, a saved search
always uses the most recent two — matching spec's framing ("on future
snapshots"), which is inherently about the next capture relative to the
last one a search was checked against, not an arbitrary historical
range.

## When this needs to change

A scheduler (the same missing piece as `docs/TRACKING.md`/
`docs/SNAPSHOTS.md`) would be what makes "on future snapshots" actually
automatic rather than only updating when someone manually captures a new
one and then visits the dashboard.
