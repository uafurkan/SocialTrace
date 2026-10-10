# Preview checks: the one-week log-only free-source read

This is the checklist for item WS-X in the approved plan. For one week, the
preview deployment logs whether the free Instagram source
(`web_profile_info`, see the matching entry in `docs/DECISIONS.md`) answers,
and how often lookups fall through to the paid Apify actor. The read uses
only log lines the code already writes; it adds none and changes no
behaviour. The plan gives no start date and no pass threshold. The owner
sets both.

## What is logged

The log lines carry the username and the HTTP status. The response body is
not logged, and this code does not keep the raw response. The mapped profile
and posts still go to the existing caches, as before.

Where the free source is called:

- The profile path (`src/lib/providers/apify/profile.ts`) and the posts path
  (`src/lib/providers/apify/posts.ts`, inside `withDataCache("posts:<profileId>")`).
  One visit can produce one line from each path. A cache hit produces none.
  Count lines, not visitors.
- The admin diagnostics probe (`src/lib/diagnostics/sources.ts`, handle
  `instagram`) calls the same function. It is reachable only through `/admin`
  and `/api/v1/diagnostics/sources`, which `src/proxy.ts` gates while
  `FEATURES.accounts` is `false`. During the preview, `profile=instagram`
  lines should not appear. If they do, check the flags before counting.

## Free Instagram source (the lines to count)

| Line (prefix as written) | Written at | Meaning | How to count |
|---|---|---|---|
| `[source-chain] instagram profile=<username> source=free ok` | `web-profile-info.ts:140` (`console.log`) | HTTP 200 with a user object that passes the shape check. | Success. |
| `[source-chain] instagram profile=<username> source=free unavailable status=<code>` | `web-profile-info.ts:126` (`console.log`) | Any HTTP status other than 200 or 404. The code comment expects `401` (`require_login`) from datacenter IPs and `429` on rate limits. The caller falls through to Apify. | Failure. Group by `<code>`. |
| `[instagram-public] web_profile_info unavailable for <username>: HTTP <code>` | `web-profile-info.ts:125` (`console.warn`) | The same event as the line above, in warn form. Printed just before it. | Do not count it again. |
| `[instagram-public] web_profile_info returned an unrecognised shape for <username>` | `web-profile-info.ts:133` (`console.warn`) | HTTP 200, but the body is not a recognised user object. No `[source-chain]` line. | Failure. Count separately. |

Silent outcomes (no line at all):

- Network error or timeout (`FETCH_TIMEOUT_MS` is 15 s): `fetchWebProfileInfo`
  returns `null` (`web-profile-info.ts:116-117`) with no log line.
- 404: throws `ProfileNotFoundError` (`web-profile-info.ts:120-122`). No line
  is written there, and the caller rethrows it rather than falling through.

These silent outcomes are not counted by the lines above. A lookup that falls
through with neither a `[source-chain]` line nor an `[instagram-public]` line
hit a network error or a timeout. The fall-through itself is not logged, so
these lookups cannot be counted from the logs.

## Paid fallback and cache (context lines)

| Line (prefix as written) | Written at | Meaning | How to count |
|---|---|---|---|
| `[apify] account usage limit hit — skipping all actor calls for 15 minutes` | `apify/client.ts:60-62` (`console.error`) | The Apify quota breaker tripped. Written once per trip, from `client.ts:151`. While tripped, actor calls fail at once (`client.ts:140-141`) with no log line. | Count trips per day. Skipped calls cannot be counted from logs. |
| `[data-cache] serving stale <cacheKey> (fetched <ISO time>) — source unavailable:` | `cache/data-cache.ts:99` (`console.warn`) | A fetch threw, and an expired cache row for that key was served instead. For a `posts:` key, the free source returned nothing and the Apify actor also failed. | Count per day. These are degraded results shown to visitors. |
| `[data-cache] failed to write cache for <cacheKey>` | `cache/data-cache.ts:110` (`console.error`) | The cache write failed. The fresh result is still returned. | Cache health, not free-source health. Count separately. |

The `[apify-provider]` lines in `apify/followers.ts` (lines 170, 172) are for
the follower actors. They are not part of this read.

## Lines the plan names that do not exist

The plan's monitoring list (section 8) and WS-C name these. The code does not
write them, so they cannot be read from the logs:

- A per-actor daily run counter (plan WS-C, "Aktör sayacı"). Apify run counts
  are not in the logs. Read usage from the Apify account, which is outside
  this repo.
- A `[video-proxy]` line with host, status and bytes (plan section 8, WS-M).
  No such line exists in `src`.
- Upstash error lines (plan section 8, WS-R). `src/lib/rate-limit.ts` has no
  `console` call.
- 429 counts. The routes return 429 responses with `Retry-After`, but nothing
  logs them, so 429 counts are not available from logs.

## What to count during the week

1. Export the preview deployment's runtime logs for the seven days. Filter for
   `[source-chain] instagram`.
2. Each day, count the `source=free ok` lines, and count the
   `source=free unavailable` lines grouped by `status=`.
3. Success rate = ok / (ok + unavailable + unrecognised-shape lines). This is
   an upper bound. Silent network failures and timeouts are not in the
   denominator, so the true rate is lower.
4. Count the `[apify]` trip lines and the `[data-cache] serving stale` lines
   per day. They show when the paid fallback also failed.
5. Check how many distinct usernames appear in the unavailable lines on the
   same day. Failures across many usernames at once suggest a block on the
   deployment's IP. Failures for a single username suggest that profile. This
   is a reading aid, not a test.
6. Record the counts and the status breakdown. The plan sets no threshold, so
   the owner decides what the result means.

## Gaps to know before trusting the result

- Silent failures (network errors and timeouts) are not logged, so the success
  rate above is an overestimate. The Phase 17 Step 2 production probe
  (`docs/DECISIONS.md`) cannot show which failure happened, because the probe
  only reports ok or not ok.
- Closing the gap needs a log line in the catch at `web-profile-info.ts:116-117`.
  That is a runtime code change and is outside this documentation workstream.
  The owner decides whether to make it.

## Reminders

- The free source uses no login, cookie or session, and the preview adds none.
- The log lines contain no response bodies.
