# Tracking / Watchlist

Spec §21. Milestone 9. The spec's version assumes a logged-in account:
"Tracked profiles" dashboard, per-profile check frequency, notification
channel. Accounts now exist (`docs/AUTH.md`) and a fixed-schedule
scheduler now runs automatic recapture with an in-app notification badge
(`docs/SCHEDULER.md`) — but there's still no per-profile frequency
picker and no real email/push channel, so this remains a deliberately
scoped-down slice, the same honest-reduction pattern as export/snapshot/
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

**No configurable check frequency, change categories, or minimum change
threshold — but automatic capture and an in-app notification now
exist.** A fixed (not user-configurable) Vercel Cron schedule recaptures
every tracked/saved-search profile once a day, and a small badge next
to the "Track" nav link surfaces new activity without visiting the
dashboard — see `docs/SCHEDULER.md`. Spec §21's per-profile frequency
picker and email/webhook notification channel still don't exist: "only
expose frequencies the backend can actually support" (spec's own words)
still means none are exposed as a user-facing setting, since there's
exactly one fixed schedule, not a per-profile choice. The dashboard
still supports manually capturing a new snapshot on demand too.

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

A per-profile configurable check frequency (spec §21) and a real email/
push notification channel are the remaining gaps — see `docs/
SCHEDULER.md` for what exists today (a fixed 6-hour schedule, an in-app
badge) and why email isn't wired up (no email-sending service
configured). Real accounts are now implemented (`docs/AUTH.md`) — a
signed-in visitor's tracked profiles
persist across devices, capped by their plan's tracked-profile limit
(`docs/BILLING.md`, free: 10). Anonymous visitors remain unlimited,
since there's no plan to enforce against them.
