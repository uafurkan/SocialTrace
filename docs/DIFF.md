# Diff Engine

Spec §20. Given two consecutive snapshots of a profile, compute what
changed: followers/following gained or lost, and profile fields (bio,
display name, avatar, verified/private status) that changed. This is the
data behind the "Changes" tab.

## What's implemented

- **Diffing happens at capture time, not read time.** `captureSnapshot`
  (`src/lib/snapshot/capture.ts`) computes the diff against the
  profile's previous snapshot as part of the same request that captures
  the new one, and writes the result into `change_events`
  (`docs/DATABASE.md`). `src/lib/diff/changes.ts`'s `listChanges(username)`
  only reads what's already there — there's no separate "run the diff"
  step or endpoint.
- `GET /api/v1/profiles/[profileId]/changes?username=<username>` — lists
  change events, most recent first. Read-only (no POST): a change event
  is only ever produced as a byproduct of capturing a snapshot. Returns
  `{ available: false, items: [] }` when `DATABASE_URL` is unset, the
  same capability-gating pattern as the snapshot and export routes.
- `/profile/[username]/changes` — now lists real change events
  (`src/components/profile/changes-list.tsx`) instead of a static
  "not available" page, when a database is configured.

## The mandatory rule this exists to satisfy (spec §20)

> A partial/lower-coverage snapshot must never be used to infer mass
> "removal" — e.g. it must not conclude "80% of followers disappeared"
> when coverage merely dropped from 100% to 20%; it should say the
> comparison is unavailable.

Because every snapshot's follower/following capture is capped at
`SNAPSHOT_MEMBER_LIMIT = 500` (`docs/SNAPSHOTS.md`), a member absent from
one snapshot's captured set might simply be outside the cap or the
provider returned the list in a different order — not actually gone (or
newly arrived). So membership diffing for a given kind
(follower/following) only runs when **both** the previous snapshot's and
the current snapshot's coverage for that kind are at least 99.5%
(`DIFF_COVERAGE_THRESHOLD` in `src/lib/snapshot/capture.ts`) — i.e. both
captures are close enough to complete that "present in one set but not
the other" reliably means what it looks like. Below that threshold on
either side, no added/removed events are recorded for that kind at all:
the honest "comparison unavailable" outcome, rather than a misleading
partial diff.

In practice this means the diff engine only produces membership events
for genuinely small accounts (under ~500 followers/following) — which is
also the only case where the underlying data is small enough to actually
be captured completely. For large accounts, `Coverage: partial` snapshots
still accumulate in the History tab, but no "gained"/"lost" claims are
ever made from them. This was verified live: `src/lib/providers/mock-provider.ts`'s
`nike` (312M followers, ~0.03% indexed) and `smallcreator` (42K
followers, capped at 500 → 1.2% indexed) never produce membership
`change_events` across repeated captures; a new small seed profile,
`tinytest` (180 followers, 95 following, both fully within the cap →
100% coverage), was added specifically to exercise this code path, since
neither existing seed happened to fit under the cap.

**Profile field changes are not coverage-gated** — `displayName`, `bio`,
`avatarUrl`, `isVerified`, `isPrivate` are read as a single complete
value from the provider on every capture (there's no partial-capture
concept for a scalar field), so any difference from the stored value is
recorded directly.

## Scope decisions

**No separate diff/comparison UI for arbitrary snapshot pairs.** The
"Compare snapshots" button on the profile header stays disabled — only
the automatic previous-vs-latest diff computed at capture time is
implemented. Comparing two arbitrarily chosen historical snapshots is a
Tracking/Watchlist-adjacent feature (needs a snapshot picker UI) and is
deferred along with Milestone 9.

**No batching/pagination beyond a simple limit.** `listChanges` returns
up to 100 most-recent events; there's no cursor pagination yet, since the
member cap means the maximum a single capture can produce is bounded
(at most `2 * SNAPSHOT_MEMBER_LIMIT` membership events plus 5 field
events) and accumulating enough history to need pagination requires many
captures, which nothing automatically triggers yet (no scheduler — see
`docs/SNAPSHOTS.md`).

## When this needs to change

Tracking/Watchlist (spec §21, Milestone 9) will schedule automatic
recurring captures, which is what will make `change_events` accumulate
meaningfully over time — at that point `listChanges` will likely need
real cursor pagination and a way to filter by change kind.
