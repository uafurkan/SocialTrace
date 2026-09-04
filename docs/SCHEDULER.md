# Scheduler & Notifications

Spec §21's tracking configuration calls for a check frequency and a
notification channel; `docs/TRACKING.md`/`docs/SAVED_SEARCHES.md` both
flagged this as missing since there was no job queue (`docs/
KNOWN_LIMITATIONS.md`). This slice adds the smallest real version of
both, scoped to what's buildable without adding Redis/BullMQ or an
email-sending service.

## What's implemented

- **`GET /api/cron/capture-tracked`**
  (`src/app/api/cron/capture-tracked/route.ts`): calls
  `runScheduledCapture()` (`src/lib/snapshot/scheduled-capture.ts`),
  which captures a fresh snapshot (`captureSnapshot`, the same function
  the manual "capture new snapshot" button uses) for every distinct
  profile that has at least one tracker or one saved search — up to
  `SCHEDULED_CAPTURE_BATCH_LIMIT` (25) per invocation, sequentially, so
  one bad profile (deleted/renamed/private) or a slow provider can't
  take down the whole batch or fan out too many concurrent calls to a
  real, billed provider (`docs/PROVIDER_CONTRACT.md`).
- **`vercel.json`** schedules that route once a day via Vercel Cron —
  the only "scheduler" this build has, chosen because it needs no new
  infrastructure (no Redis, no separate worker process) beyond a
  `vercel.json` file and one env var, and the user confirmed Vercel is
  the deploy target. Once a day, not more often: the **Hobby** plan
  rejects a `vercel.json` whose cron schedule fires more than once a
  day — a `0 */6 * * *` (every 6 hours) schedule was tried first and
  silently blocked every deployment from that commit onward (no build
  log, no entry in the Deployments list — Vercel refuses the deployment
  at config-validation time, before a build ever starts). See
  `docs/DECISIONS.md`.
- **Auth**: the route refuses to run at all unless `CRON_SECRET` is set
  and the request's `Authorization: Bearer <value>` header matches it.
  Vercel automatically sends that header on cron invocations once
  `CRON_SECRET` is configured as an env var — see [Vercel's cron docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
  Without the env var set, every request gets `501`, including one with
  no header at all — this endpoint triggers real (potentially billed)
  provider calls, so it must never be an open door.
- **In-app notification, not email.** `GET /api/v1/tracking/summary`
  reuses the exact same reads `/tracking` itself does (`listTrackedProfiles`,
  `listSavedSearches`) to compute one number: how many tracked profiles
  have a nonzero follower delta since their last two snapshots, plus how
  many saved-search new/removed matches exist right now. `TrackNavBadge`
  (`src/components/layout/track-nav-badge.tsx`) shows that number as a
  small badge next to the "Track" link in both the desktop and mobile
  nav, fetched client-side (same reasoning as `AccountMenu` — reading
  the identity cookie in the shared header would break static
  generation, see `docs/AUTH.md`).

## Why not real email/push

Sending a real notification needs a real email-sending service (Resend,
SendGrid, ...) and a verified sending domain — neither exists in this
build, and a fake "email sent" flow that doesn't actually send anything
would be dishonest in exactly the way `docs/DECISIONS.md`'s running
"real-but-scoped, not simulated" theme argues against. Asked directly,
the choice was in-app only for this slice. The badge above is pull
information made slightly more push-like (you see it in the nav without
opening `/tracking`), not a real push notification.

## Scope decisions

**Sequential, not parallel, capture.** `runScheduledCapture` awaits each
`captureSnapshot` one at a time. A real provider (Apify) bills per
result and has its own rate limits; firing 25 concurrent captures once
a day multiplies both the cost spike and the chance of hitting a
provider-side limit, for no benefit a cron job actually needs (it isn't
latency-sensitive).

**No dedup / backoff / retry.** A profile that fails this run (provider
error, renamed account) simply gets tried again on the next scheduled
run a day later — there's no persisted "this one is broken, stop
retrying" state. Acceptable for a fixed low-frequency schedule; would
need real backoff bookkeeping before running much more often.

**The badge count double-computes rather than caching.** No "unread"
column recording what you've already seen — it's always "what would
`/tracking` show you right now," recomputed on each request the same
way the page itself does. Simpler and can't drift out of sync with the
page, at the cost of doing the same DB reads twice if you both see the
badge and then open `/tracking`.

## When this needs to change

Real push/email notifications need an actual email-sending service
account and a decision about unsubscribe/preference handling — a real
integration, not something to fake (`docs/DECISIONS.md`). Higher-
frequency or larger-scale capture would need a real queue (BullMQ/
Redis or a managed equivalent) instead of a fixed-interval cron hitting
one route, plus per-profile backoff state so a permanently broken
profile stops being retried forever.
