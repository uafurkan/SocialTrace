# Snapshot tools: re-enabling plan (WS-S)

Status: plan only. No code, flag or cron entry changes. It follows
`docs/DECISIONS.md` (snapshot tools off until the owner re-enables them; Neon
stays). Guesses are marked **(guess)**.

## 1. What each tool shows

Gated by `FEATURES.snapshots` (`src/lib/features.ts`) unless noted.

- **Follower history** (`/tools/instagram-follower-history`): follower and
  following counts per snapshot (`profile_snapshots`).
- **Growth tracker** (`/tools/instagram-growth-tracker`): count delta since the
  previous snapshot. Its dashboard (`/tracking`) needs `FEATURES.tracking`. The
  "Saved searches inline" copy goes.
- **Bio history** and **username history**: `change_events` rows filtered by
  `field` (`bio`, `username`). Username history matches accounts by
  `profiles.external_id`, which is null for Facebook.
- **Follower compare** (`/tools/instagram-follower-compare`,
  `/profile/[username]/compare`): who followed and unfollowed, built from
  `memberships`. Excluded; see section 3.

## 2. Data model and daily job

Tables on the re-enabled path:

- `profiles`: unique `(platform, normalized_username)`; `external_id` for renames.
- `profile_snapshots`: index `(profile_id, captured_at)`; one row per capture
  (counts and coverage). Its `indexed_*` and coverage columns are NOT NULL, so
  counts-only capture needs a migration **(guess: make them nullable)**.
- `change_events`: index `(profile_id, detected_at)`; only `field` rows
  (username, displayName, bio, avatarUrl, isVerified, isPrivate).
- `watchlist_entries`: unique `(visitor_id, profile_id)`; only with `tracking` on.

Not written on the re-enabled path: `social_users`, `memberships`, and
membership rows in `change_events`.

**Retention: 365 days** for `profile_snapshots` and `change_events`, purged in
the daily run **(guess)**. No purge code exists today.

**Daily job.** Vercel Cron calls `GET /api/cron/capture-tracked`, which runs
`runScheduledCapture()` against Neon over HTTP. Restore the entry removed in
commit 68c6856: `{ "path": "/api/cron/capture-tracked", "schedule": "0 4 * * *" }`.
The Hobby plan allows one run a day (`docs/DECISIONS.md`). `docs/SCHEDULER.md`
says `vercel.json` already has this entry; that is stale. The route needs
`CRON_SECRET`: 501 if it is unset, 401 for a wrong `Authorization: Bearer`
(`src/app/api/cron/capture-tracked/route.ts`).

Capture-path changes before enabling:

- Counts-only: no `collectPages` calls, so one profile call per capture.
- Use `getCachedProfile`. `captureSnapshot` calls the provider directly today.
- The docs and help copy say 500 identities per list. Apify caps lists at
  `MEMBER_FETCH_CAP` = 200 (`src/lib/providers/apify/index.ts`). Correct them to
  say that counts are stored.

## 3. Consent and scope rules

**Rule (proposed).** A snapshot stores public counts and public profile fields
only. No table stores the identities of a third party's follower or following
list. Tracking such a list stays excluded (WS-O note, section 1). In code:

- `captureSnapshot` drops the `social_users` and `memberships` writes, the
  membership change events and the membership diff (`src/lib/snapshot/capture.ts`).
- Follower compare stays off and gets its own flag, `memberComparison: false`
  **(guess)**, or the page is removed.
- Saved searches match member names. Today `tracking` also enables them
  (`/api/v1/saved-searches`, `src/components/followers/member-list.tsx`). They
  need their own flag, `savedSearches: false` **(guess)**.
- The Followers and Following tabs keep showing lists. Their 48-hour `members:`
  entries in `provider_cache` are a viewing cache; whether that is acceptable is
  open (section 8).

**Open decision: what a user must do before a profile is tracked.** The owner
has not decided this.

- (a) Clicking Track is enough. This is today's behaviour, and covers public
  data only.
- (b) The visitor sees a short notice (counts and public fields only, no lists)
  and confirms once. The confirmation is stored on the watchlist row. **Guess:
  the minimum for launch.**
- (c) A removal request from the profile owner adds the username to an
  exclusion table, replacing the hard-coded `CAPTURE_EXCLUDED_USERNAMES` in
  `src/lib/snapshot/scheduled-capture.ts`. The privacy page says a removal path
  will be described once real data is connected.
- (d) The owner opts in through an account claim. **Guess: too large for this
  slice.**

Plan default **(guess)**: (b) and (c) before `tracking` is enabled.

## 4. Rate and cost limits

- Batch: `SCHEDULED_CAPTURE_BATCH_LIMIT` = 25, run sequentially. **Guess:** 5 to
  8 after measuring on preview.
- `maxDuration` = 60. Estimate, not measured: profile calls take about 11 s and
  actor runs 10 to 25 s (`docs/PROVIDER_CONTRACT.md`), so a batch of 25 may not
  finish. The run must log skipped profiles.
- Profile cache (`PROFILE_CACHE_TTL_HOURS`, default 6) once `getCachedProfile`
  is used. Member lists are not fetched, so there is no member cost.
- The cold budget (6 member-list starts per 10 minutes per IP,
  `src/lib/cache/cold-budget.ts`) covers member routes only. The job needs its
  own ceiling: the batch limit, once a day **(guess)**.
- Manual capture: `CAPTURE_RATE_LIMIT` = 10 per 10 minutes per client. The
  client key trusts the first `x-forwarded-for` entry (`src/lib/rate-limit.ts`);
  verify on preview.

## 5. Feature flags and rollout

`src/lib/features.ts` holds four `as const` booleans with no env override. A
flip is a code change and a deploy, so a preview flip needs its own branch build.

1. **Preview:** `snapshots: true` (History, Changes, follower history, bio and
   username history, growth tracker page). Follower compare and saved searches
   stay off.
2. **Production:** `snapshots: true`, after the section 7 checks pass.
3. **Production:** `tracking: true`, only after the consent rule and the cron
   entry are in place. This enables Track, `/tracking` and the daily job.
   `/api/cron` is gated by `tracking`, so the job does not run while it is off.

**Rollback.** Set the flag back to `false` and redeploy. Gated pages return a
301 to `/` and API routes return 404 (`src/proxy.ts`). Rows stay in Neon.
Browsers cache 301s, so some returning visitors may still be sent home.

## 6. Tests before enabling

- **Unit** (`npm test`): the retention cutoff (new pure function);
  `diffProfileFields` (not exported today, so export it); a check that the
  counts-only path writes no membership rows. `coveragePercentFor` and
  `normalizeUsername` are already tested.
- **Route** (no route harness exists; see `docs/TESTING.md`; **guess:** Vitest
  calling handlers with `NextRequest`): cron returns 501 without `CRON_SECRET`,
  401 with a wrong bearer, and 200 with the right one. Snapshot POST returns 429
  after 10 calls and 501 without a database. `src/proxy.ts` returns 404 or 301
  for each gated path while its flag is off.
- **Integration** (`npm run test:integration`, real Neon): one capture writes one
  `profile_snapshots` row and no `social_users` or `memberships` rows. A second
  capture with a changed bio writes one `change_events` row (`field = 'bio'`).
  The purge removes only rows older than the cutoff. A batch never exceeds its limit.

## 7. Preview checks

- `/profile/<user>/history` returns 200. `/profile/<user>/compare`,
  `/tools/instagram-follower-compare` and `/api/v1/profiles/<id>/compare` do not.
- Search the history and changes HTML for a known follower's username. It must
  not appear.
- Row counts in `social_users` and `memberships` do not change after a capture.
- Cron on preview, with `CRON_SECRET` set on preview only: an unauthenticated
  request gets 401; an authenticated run logs attempted, succeeded and failed
  profiles, with time per profile.
- The privacy page says no real data is stored (`src/app/privacy/page.tsx`).
  Correct it before enabling.

## 8. Open decisions for the owner

1. The tracking consent rule (section 3, options a to d).
2. Retention in days (365 is a guess).
3. Whether the 48-hour member-list cache in `provider_cache` is acceptable.
4. Whether to purge existing member-list rows in Neon.
5. Follower compare: keep it off, or retire the page.
6. Batch size and daily ceiling (25 now; 5 to 8 after measurement **(guess)**).
7. Whether `captureSnapshot` moves to the profile cache.
8. The removal-request process and privacy page wording.
9. Whether `savedSearches` and `memberComparison` become separate flags.
