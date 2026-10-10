# Follower Comparison

Spec §23. Pick two snapshots and see who was gained and lost between them —
the feature the profile header's "Compare snapshots" button pointed at
(disabled) since the earliest slice of this build.

**Status: effectively off.** Captures no longer store follower or following
identities (`docs/SNAPSHOTS.md`), so a comparison can only use captures made
before 2026-10-10, and those hold the third-party identities the project no
longer keeps. The page and endpoint are also switched off by
`FEATURES.snapshots`. Whether to keep this feature, and in what form, is an
owner decision (`docs/SNAPSHOT_PLAN.md`, section 8, item 5).

## What's implemented

- `src/lib/diff/compare.ts`'s `compareSnapshots(username, kind, fromId,
  toId)` reconstructs who was an active follower/following "as of" each
  snapshot's `captured_at` timestamp directly from the `memberships`
  table's `first_seen_at`/`removed_at` columns — **no new per-snapshot
  membership log table was needed.** A social user counts as active as of
  time T if `first_seen_at <= T` and (`removed_at` is null or `removed_at
  > T`). This works for *any* two snapshots of the same profile, not just
  consecutive ones, because those two columns already describe the whole
  membership timeline, not just "current state." Captures since 2026-10-10
  write no membership rows, so they add no members to this reconstruction.
- `GET /api/v1/profiles/[profileId]/compare?username=&kind=follower|following&from=<snapshotId>&to=<snapshotId>` —
  computed on demand, nothing is persisted (unlike `docs/DIFF.md`'s
  automatic change_events, which are a byproduct of capture and only ever
  compare a snapshot to the one immediately before it).
- `/profile/[username]/compare` (`src/components/profile/snapshot-comparer.tsx`) —
  From/To snapshot pickers (defaulting to oldest/newest), a dataset
  toggle (followers/following), and Overview/New/Removed tabs matching
  spec §23's layout, with the New/Net/Removed counters.

## Why this doesn't need a new coverage-gate rule of its own

It reuses the exact same rule and threshold as `docs/DIFF.md`
(`DIFF_COVERAGE_THRESHOLD` in `src/lib/snapshot/capture.ts`, exported for
this module to import): a comparison is only computed when **both**
chosen snapshots' stored coverage for that kind is ≥99.5%. Below that, the
endpoint returns `available: false` with an explanation instead of
new/removed lists. Every capture since 2026-10-10 stores 0% coverage, so any
pair that includes one returns `available: false`. Spec §20's rule (never
infer removal from a partial capture) applies here exactly as it does to the
automatic diff.

Before 2026-10-10 the gate was checked against real data: a real gained
member and a real removed member between two full-coverage snapshots were
classified correctly, and a comparison against a low-coverage snapshot
returned "unavailable" instead of a number.

## Scope decisions

**No "Unchanged" tab.** Spec §23 doesn't show one either (it lists
Overview/New/[Removed] as the tabs) — an unchanged list is usually the
large majority of a follower base and isn't the point of a comparison
view.

**No caching of comparison results.** Each request re-reads and
re-reconstructs both membership sets. Captures before 2026-10-10 held at
most 500 members per list, so each request stayed small. Caching would be
premature.

## When this needs to change

The reconstruction itself would not change. It can only return results if
member data is stored again, and the project rule against storing
third-party follow lists rules that out. Do not re-enable member capture
without a new decision recorded in `docs/DECISIONS.md`.
