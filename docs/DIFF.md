# Diff Engine

Spec §20. Given the previous snapshot and the new one of a profile, record
what changed in the profile's own fields: username, display name, bio,
avatar, and verified or private status. This is the data behind the
"Changes" tab.

Follower and following changes are no longer computed. Captures do not
fetch member lists (`docs/SNAPSHOTS.md`), so there is nothing to diff. The
membership rows from captures made before 2026-10-10 are still in the
database, and the owner has not decided what to do with them
(`docs/DECISIONS.md`).

## What's implemented

- **Diffing happens at capture time, not read time.** `captureSnapshot`
  (`src/lib/snapshot/capture.ts`) compares the stored profile row with the
  new provider data, and writes the changed fields into `change_events` in
  the same request that captures the new snapshot. `src/lib/diff/changes.ts`'s
  `listChanges(username)` only reads what is already there.
- `GET /api/v1/profiles/[profileId]/changes?username=<username>` — lists
  change events, most recent first. Read-only (no POST): a change event is
  only ever produced as a byproduct of capturing a snapshot. Returns
  `{ available: false, items: [] }` when `DATABASE_URL` is unset, the same
  capability-gating pattern as the snapshot and export routes.
- `/profile/[username]/changes` — lists the change events
  (`src/components/profile/changes-list.tsx`) when a database is configured.

## Coverage gate for member comparisons (spec §20)

> A partial/lower-coverage snapshot must never be used to infer mass
> "removal" — e.g. it must not conclude "80% of followers disappeared"
> when coverage merely dropped from 100% to 20%; it should say the
> comparison is unavailable.

Membership diffs needed both snapshots to be at least 99.5% covered
(`DIFF_COVERAGE_THRESHOLD`, `src/lib/snapshot/capture.ts`), because a member
missing from a partial capture might simply be outside the cap. Captures
since 2026-10-10 index no members, so they never meet this gate. The gate
still applies in `src/lib/diff/compare.ts`, so any comparison that uses such
a snapshot reports "unavailable" (`docs/FOLLOWER_COMPARISON.md`).

**Profile field changes are not coverage-gated.** `displayName`, `bio`,
`avatarUrl`, `isVerified` and `isPrivate` are read as complete values from
the provider on every capture, so any difference from the stored value is
recorded directly.

## What the change log contains

- **Field events only.** `field` is one of `username`, `displayName`, `bio`,
  `avatarUrl`, `isVerified` or `isPrivate`. One capture writes at most six.
- **Not written any more:** `membership_event`, `membership_kind` and
  `social_user_id` rows (added and removed followers).
- **Still returned:** `GET .../changes` returns every row for the profile,
  including membership rows written before 2026-10-10. Its `user` field comes
  from `social_users`, so those rows show third-party usernames. Filtering
  them out, or deleting them, is an owner decision (`docs/DECISIONS.md`).

## Scope decisions

**No separate diff UI for arbitrary snapshot pairs in this file.** Comparing
two chosen snapshots is the comparison page (`docs/FOLLOWER_COMPARISON.md`).
This file covers only the automatic field diff computed at capture time.

**No batching/pagination beyond a simple limit.** `listChanges` returns up
to 100 most-recent events, with no cursor pagination. A capture writes at
most six field events, and nothing triggers captures automatically yet
(`docs/SCHEDULER.md`), so the history grows slowly.

## When this needs to change

Automatic recurring captures (`docs/SCHEDULER.md`, `docs/SNAPSHOT_PLAN.md`)
would make `change_events` accumulate meaningfully over time. At that point
`listChanges` will need real cursor pagination and a way to filter by change
kind.
