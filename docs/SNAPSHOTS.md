# Snapshot Engine

Spec §19. A snapshot is "the atomic historical observation" of a profile
— counts, coverage, and a captured follower/following membership set, at
one point in time. This is what the Diff Engine (the next milestone, spec
§20) will compare two of to compute added/removed followers.

## What's implemented

- `src/lib/snapshot/capture.ts`:
  - `captureSnapshot(username)` — fetches the profile and a bounded
    follower/following list from the active `SocialDataProvider`, upserts
    `profiles` and `social_users` rows (by `(platform, normalized_username)`,
    a unique index added in `drizzle/0001_naive_multiple_man.sql`), bumps
    `memberships.last_seen_at` for everyone still present, and inserts one
    `profile_snapshots` row with the counts and this snapshot's own
    coverage.
  - `listSnapshots(username)` — the profile's snapshot history, most
    recent first.
- `GET/POST /api/v1/profiles/[profileId]/snapshots?username=<username>` —
  `GET` lists history; `POST` captures a new one. Both require
  `DATABASE_URL` to be set; without it `GET` returns `{ available: false,
  items: [] }` and `POST` returns `501`, rather than crashing — the same
  capability-gating pattern as `ProviderCapabilities` elsewhere in this
  app.
- `/profile/[username]/history` — was a static "not available" page;
  now lists real captured snapshots and has a **Capture snapshot now**
  button (`src/components/profile/snapshot-history.tsx`) when a database
  is configured, falling back to the not-available state when it isn't.

## Scope decisions

**Synchronous, not the spec's job-queue lifecycle.** Spec §19 describes
REQUESTED → QUEUED → COLLECTING → NORMALIZING → VALIDATING → INDEXING →
COMPLETED, which assumes a job queue. This build has none (see
`docs/KNOWN_LIMITATIONS.md`), so a snapshot is captured synchronously
inside the POST request — the same honest-scope reduction already applied
to the export system (`docs/EXPORT.md`).

**Bounded follower/following capture.** `SNAPSHOT_MEMBER_LIMIT = 500` per
kind, for the same reason as `EXPORT_LIST_LIMIT` and the Apify provider's
`MEMBER_FETCH_CAP`: capturing "all of them" for a large account would be
slow and, on the real provider, expensive. **The snapshot's own
`followerCoveragePercent`/`followingCoveragePercent` are computed from
`indexed / profile.followerCount` — i.e. what this snapshot actually
persisted — not copied from the provider's separate coverage claim.** A
provider can honestly report near-100% coverage (it could serve the whole
list) while a snapshot only stores a capped sample of it; showing the
provider's number in the snapshot history would misrepresent what the
database actually holds. This is the same data-honesty principle (spec
§1.2) as everywhere else in the app, applied to a new place it could have
been gotten wrong.

**No posts/reels capture, no manual trigger scheduling.** A snapshot here
only captures profile fields and follower/following membership — not the
media feed (`media_items` stays unwritten). Posts/reels aren't part of the
diff model spec §20 describes (added/removed followers, changed profile
fields), so persisting them isn't needed for the next milestone and would
just be more data to keep in sync for no consumer. There's also no
scheduler: capture only happens when a user clicks "Capture snapshot now"
or calls the API directly — recurring automatic capture is a Tracking/
Watchlist concern (spec §21, Milestone 9), which needs auth and a job
queue neither of which exist yet.

**Removal detection exists, but is coverage-gated.** `captureSnapshot`
does set `removed_at` on a membership — but only when doing so is
actually safe (see `docs/DIFF.md` for the full rule): both the previous
and current snapshot's coverage for that kind must be at least 99.5%.
Spec §20 is explicit that inferring "removed" from one snapshot with
lower coverage than the last is wrong (it must not conclude "80% of
followers disappeared" when coverage dropped from 100% to 20% — it
should say comparison is unavailable), so below that threshold nothing
is marked removed and no `change_events` row is written for that kind.

## When this needs to change

~~The Diff Engine milestone will read two `profile_snapshots` rows...~~
Done — see `docs/DIFF.md`. `captureSnapshot` now also computes the diff
against the profile's previous snapshot (added/removed members, changed
fields) as part of the same capture, applying spec §20's "don't
overinterpret a coverage drop" rule, and writes the result to
`change_events`. The description above of what a single call to
`captureSnapshot` does is otherwise unchanged.
