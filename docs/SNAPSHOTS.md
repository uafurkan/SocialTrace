# Snapshot Engine

Spec §19. A snapshot is the profile's own observation at one point in
time: its public follower, following and post counts, and its fields
(username, display name, bio, avatar, verified and private flags). The
History page and the field history in `docs/DIFF.md` are built on these.

A snapshot does not capture follower or following lists. Those lists are
other people's identities, and this project does not track or store them
(`docs/SNAPSHOT_PLAN.md`, section 3).

## What's implemented

- `src/lib/snapshot/capture.ts`:
  - `captureSnapshot(username)` — fetches the profile from the active
    `SocialDataProvider`, upserts the `profiles` row (by `(platform,
    normalized_username)`, or by `external_id` when the profile was
    renamed), inserts one `profile_snapshots` row with the counts, and
    inserts `change_events` rows for any profile field that changed since
    the previous snapshot. It never requests a follower or following list
    and writes no `social_users` or `memberships` row.
  - `listSnapshots(username)` — the profile's snapshot history, most
    recent first.
- `GET/POST /api/v1/profiles/[profileId]/snapshots?username=<username>` —
  `GET` lists history; `POST` captures a new one. Both require
  `DATABASE_URL` to be set; without it `GET` returns `{ available: false,
  items: [] }` and `POST` returns `501`, rather than crashing.
- `/profile/[username]/history` — lists captured snapshots and has a
  **Capture snapshot now** button (`src/components/profile/snapshot-history.tsx`)
  when a database is configured, falling back to the not-available state
  when it isn't.
- The snapshot routes and pages are switched off by `FEATURES.snapshots`
  (`src/lib/features.ts`), so none of this is reachable until the owner
  turns the flag on.

## Scope decisions

**Synchronous, not the spec's job-queue lifecycle.** Spec §19 describes
REQUESTED → QUEUED → COLLECTING → NORMALIZING → VALIDATING → INDEXING →
COMPLETED, which assumes a job queue. This build has none (see
`docs/KNOWN_LIMITATIONS.md`), so a snapshot is captured synchronously
inside the POST request — the same honest-scope reduction already applied
to the export system (`docs/EXPORT.md`).

**Counts and profile fields only.** Earlier captures also wrote up to
`SNAPSHOT_MEMBER_LIMIT = 500` follower and following identities per
capture, into `social_users` and `memberships`. That breaks the project
rule against storing a third party's follow list. The capture path no
longer does this, and the constant and the membership diff are gone. The
rows those captures left in the database, and the owner's open decision
about them, are in `docs/DECISIONS.md` (2026-10-10 entry).

Every capture now writes `indexed_follower_count` and
`indexed_following_count` as `0`, and both coverage percentages as `0`.
Nothing is indexed, and the columns are NOT NULL (`src/lib/db/schema.ts`),
so zero is written rather than null. A zero-coverage snapshot never meets
the 99.5% gate in `docs/FOLLOWER_COMPARISON.md`, so any comparison that
uses one reports "unavailable". The provider's own coverage claim is not
copied either: it describes the provider's data, not what this database
holds.

**Profile field history.** A change to `username`, `displayName`, `bio`,
`avatarUrl`, `isVerified` or `isPrivate` since the previous snapshot is
written to `change_events` as a `field` / `oldValue` / `newValue` row.
Follower and following counts are stored on each snapshot row, but a
count change does not write a `change_events` row.

**No posts/reels capture, no manual trigger scheduling.** A snapshot does
not capture the media feed (`media_items` stays unwritten). Posts and reels
are not part of the change model in `docs/DIFF.md`, so storing them would
be data with no consumer. Captures run only when someone clicks "Capture
snapshot now" or calls the API. The daily run described in
`docs/SCHEDULER.md` is off.

## When this needs to change

Counts-only capture on a daily schedule, the consent rule and the steps to
re-enable it are in [docs/SNAPSHOT_PLAN.md](SNAPSHOT_PLAN.md). That plan
also covers purging rows already in the database, which the owner has not
decided.
