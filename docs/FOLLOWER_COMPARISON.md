# Follower Comparison

Spec §23. Pick two snapshots and see specifically who was gained and lost
between them — the feature the profile header's "Compare snapshots"
button pointed at (disabled) since the earliest slice of this build.

## What's implemented

- `src/lib/diff/compare.ts`'s `compareSnapshots(username, kind, fromId,
  toId)` reconstructs who was an active follower/following "as of" each
  snapshot's `captured_at` timestamp directly from the `memberships`
  table's `first_seen_at`/`removed_at` columns — **no new per-snapshot
  membership log table was needed.** A social user counts as active as of
  time T if `first_seen_at <= T` and (`removed_at` is null or `removed_at
  > T`). This works for *any* two snapshots of the same profile, not just
  consecutive ones, because those two columns already describe the whole
  membership timeline, not just "current state."
- `GET /api/v1/profiles/[profileId]/compare?username=&kind=follower|following&from=<snapshotId>&to=<snapshotId>` —
  computed on demand, nothing is persisted (unlike `docs/DIFF.md`'s
  automatic change_events, which are a byproduct of capture and only ever
  compare a snapshot to the one immediately before it).
- `/profile/[username]/compare` (`src/components/profile/snapshot-comparer.tsx`) —
  From/To snapshot pickers (defaulting to oldest/newest), a dataset
  toggle (followers/following), and Overview/New/Removed tabs matching
  spec §23's layout, with the New/Net/Removed counters. The profile
  header's "Compare snapshots" button now links here instead of being
  permanently disabled.

## Why this doesn't need a new coverage-gate rule of its own

It reuses the exact same rule and threshold as `docs/DIFF.md`
(`DIFF_COVERAGE_THRESHOLD` in `src/lib/snapshot/capture.ts`, exported for
this module to import): a comparison is only computed when **both**
chosen snapshots' stored coverage for that kind is ≥99.5%. Below that,
the endpoint returns `available: false` with an explanation instead of
new/removed lists — spec §20's rule (never infer removal from a partial
capture) applies here exactly as much as it does to the automatic diff,
since this is the same underlying claim ("this specific account is
gone"), just computed for an arbitrary pair instead of only the latest
pair. Verified live against the real Neon database: a real gained member
and a real removed member between two full-coverage snapshots were
correctly classified, and a comparison against a synthetic low-coverage
snapshot correctly returned "unavailable" instead of a number.

## Scope decisions

**No "Unchanged" tab.** Spec §23 doesn't show one either (it lists
Overview/New/[Removed] as the tabs) — an unchanged list is usually the
large majority of a follower base and isn't the point of a comparison
view.

**No caching of comparison results.** Each request re-reads and
re-reconstructs both membership sets. Given `SNAPSHOT_MEMBER_LIMIT = 500`
(the only accounts this can ever produce results for, per the coverage
gate), this is at most 1,000 rows per side — cheap enough that caching
would be premature.

## When this needs to change

Nothing about the reconstruction approach needs to change for larger
accounts — it degrades to "unavailable" for them today by design (per
the coverage gate) and will continue to for as long as capture stays
capped at 500. If a future slice adds a scheduler and larger/incremental
capture, this module keeps working unmodified.
