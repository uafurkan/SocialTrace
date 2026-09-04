# Tracking / Watchlist

Spec §21. Milestone 9. The spec's version assumes a logged-in account:
"Tracked profiles" dashboard, per-profile check frequency, notification
channel. This build has no auth, no scheduler, and no notification
channel (see `docs/KNOWN_LIMITATIONS.md`), so this is a deliberately
scoped-down slice — the same honest-reduction pattern as export/snapshot/
diff.

## What's implemented

- **Anonymous, cookie-identified tracking by default — account-scoped if
  signed in.** Clicking "Track profile" issues a first-party `st_visitor`
  cookie (a random UUID, httpOnly, 1-year expiry —
  `src/lib/tracking/visitor-cookie.ts`) the first time it's needed, and
  stores a `watchlist_entries` row keyed by that id
  (`src/lib/db/schema.ts`). Clearing cookies loses the watchlist; there's
  no recovery. **Update (see `docs/AUTH.md`):** now that accounts exist,
  a signed-in visitor's key becomes `account:<userId>` instead of the
  cookie — `src/lib/auth/identity.ts`'s `resolveIdentity` decides which,
  per request. Tracking a profile while signed in makes it follow the
  account across browsers/devices instead of staying pinned to one
  browser; tracking while signed out behaves exactly as it always did.
- `POST/DELETE /api/v1/profiles/[profileId]/track?username=<username>` —
  track/untrack for the current visitor. `GET` on the same path reports
  whether the current visitor is tracking that profile (used to render
  the profile header's button in the right initial state without a
  client-side round trip — see below).
- `GET /api/v1/tracking` — the current visitor's tracked profiles, each
  with the latest captured follower count and the delta versus the
  snapshot before it (`src/lib/tracking/watchlist.ts`'s
  `listTrackedProfiles`).
- `/tracking` — the "Tracked profiles" dashboard from spec §21, listing
  each tracked profile with a "+N since last snapshot" / "−N since last
  snapshot" line, or an honest "no snapshots yet" / "capture one more to
  see a change" message when there's nothing to diff against.
- The profile header's "Track profile" button
  (`src/components/profile/track-button.tsx`) is now functional, toggling
  between "Track profile" and "Tracking active" (spec's copy, already
  present in `src/lib/copy.ts` before this slice). Its initial state is
  computed server-side in `src/app/profile/[username]/layout.tsx` (reads
  the `st_visitor` cookie via `next/headers`), so the button doesn't flash
  from the wrong state on load.
- Tracking a never-before-seen profile works without requiring a snapshot
  first — `trackProfile` fetches the profile from the active provider and
  upserts a `profiles` row (reusing `upsertProfileRow` from
  `src/lib/snapshot/capture.ts`) just like a snapshot capture would, so a
  "0 snapshots yet" profile can still appear on the dashboard immediately.

## Scope decisions

**No check frequency, change categories, notification channel, or
minimum change threshold.** All four are explicitly listed in spec §21's
"Tracking configuration," and all four require infrastructure this build
doesn't have: a scheduler to run checks on a frequency, and a
notification channel (email/webhook/etc.) to notify through. Spec §21
itself says "only expose frequencies the backend can actually support" —
since it can support none (there's no recurring capture at all), none are
exposed. The dashboard instead tells the visitor outright that they need
to manually capture a new snapshot (from the profile's History tab) to
update the numbers here.

**The follower delta uses the profile's own reported follower count, not
a coverage-gated membership diff.** "+842 since last snapshot" (spec's
own example) is a difference of two whole-profile counts
(`profile_snapshots.follower_count`), the same number shown on the
profile header — not `indexed_follower_count`. This is consistent with
how the rest of the app already treats a profile's stated follower count
(always shown as-is, coverage is reported separately) — it is not the
membership-level added/removed accounting from `docs/DIFF.md`, which
*is* coverage-gated because it's naming specific accounts as gained/lost.
A total-count delta carries no such claim about which accounts changed,
so the coverage gate doesn't apply to it.

**No "Compare snapshots" UI.** That button stays disabled on the profile
header — spec §23 (Follower Comparison) is a separate, larger feature
(arbitrary snapshot-pair picker, new/removed/unchanged tabs) not part of
this slice.

## When this needs to change

A scheduler (spec §21's "check frequency") is what would make the
dashboard's numbers move without a manual capture, and is the same
missing piece noted in `docs/SNAPSHOTS.md`. Real accounts are now
implemented (`docs/AUTH.md`) — a signed-in visitor's tracked profiles
persist across devices, capped by their plan's tracked-profile limit
(`docs/BILLING.md`, free: 10). Anonymous visitors remain unlimited,
since there's no plan to enforce against them.
