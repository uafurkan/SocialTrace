# Video Transcriber

A second, independent product surface (`/transcribe`) alongside
SocialTrace's Instagram-analytics identity: paste a public YouTube,
TikTok, Instagram, or Facebook video link and get a text transcript back.
Link-only in this slice — file upload is a documented future slice, not
built yet (`transcript_platform`'s `"upload"` enum value is reserved for
it).

## Why a unified pipeline, not per-platform actors

Rather than relying on an all-in-one "download + transcribe" actor per
platform, the pipeline decouples the two steps:

```
resolveAudioSource(url)
  - YouTube: try official timedtext captions first (free, instant)
  - Any link: reinventingai/video-or-audio-downloader (yt-dlp-based,
    covers all four platforms with one actor/one input shape) -> audio URL

transcribeAudio(audioUrl, language?)
  - Primary: Groq whisper-large-v3-turbo (9x cheaper than OpenAI's own
    endpoint, ~15s to transcribe an hour of audio, generous free tier)
  - Fallback: OpenAI Whisper API, only if Groq itself errors/rate-limits
```

One transcription code path, shared by every platform, instead of four
platform-specific normalizers with inconsistent output shapes. See
`src/lib/transcription/index.ts`.

If the primary pipeline fails end-to-end for a URL (downloader actor
can't reach it, or speech-to-text fails after a successful download), a
last-resort independent all-in-one actor
(`tictechid/anoxvanzi-transcriber`) is tried before giving up — an
alternative route to the same result, not just a retry of the same path.
Its output has no per-segment timestamps, so a fallback-actor result
comes back with `segments: []` — an honest degradation, not a bug.

Both the downloader's and the fallback actor's exact output shapes were
verified live against real public videos during development (not trusted
from their store descriptions), the same methodology already established
for the Instagram follower-scraper fallback chain.

## Every bad-outcome scenario this was designed against

| Scenario | Response |
|---|---|
| Apify's account-wide concurrent-run cap (the bug fixed for the Instagram viewer, see `docs/DECISIONS.md`) gets worse from added actor volume | A per-instance semaphore in `src/lib/providers/apify/client.ts` caps in-flight `runApifyActor` calls app-wide (4), queuing rather than firing past the cap — benefits every Apify-backed feature, not just this one. |
| Downloader actor or Groq down/rate-limited | Downloader has no cross-platform fallback needed (one actor covers all four); on failure the all-in-one fallback actor is tried instead. Groq falls back to OpenAI Whisper if configured. |
| Private/deleted/geo-restricted video | Downloader returns a clean empty/error result, mapped to an honest `private_or_restricted`-style message — never an infinite spinner. |
| Unsupported URL | `detectPlatform()` rejects client- and server-side before any external call — zero cost. |
| No speech in the video | Detected and shown as an honest "no speech detected" state, not a blank success. |
| Very long video | Hard 30-minute cap (`MAX_VIDEO_DURATION_SECONDS`), enforced once duration is known from the downloader's metadata, before transcribing. |
| Vercel's function budget | `maxDuration = 60` (same pattern as the rest of the app) plus the length cap above keeps realistic runs well under budget. |
| Duplicate concurrent requests for the same viral link | `transcript_cache` row inserted with `status="processing"` via `ON CONFLICT DO NOTHING` before work starts; a second request finds the in-flight row and polls it instead of re-triggering a second paid run. |
| Bot/scripted abuse driving cost | Layered: per-visitor rate limiting (`src/lib/rate-limit.ts`), a daily per-scope quota (`src/lib/transcription/quota.ts` — anonymous 3/day, free account 5/day, Pro 50/day), and a global daily *billed* ceiling (300/day) that refuses new uncached requests once crossed. |
| Cache poisoning / stale failure | The cache row is written only on full pipeline success; a failed attempt deletes its claim row so the next request retries cleanly, rather than being stuck on a permanently-cached failure. |

## Database

`transcript_cache` (keyed by a single `cache_key` column — normalized
source URL — for the same reason `provider_cache` uses a single natural
key instead of a composite one, see its comment in `schema.ts`) and
`transcription_usage` (one row per request a visitor actually consumed,
scoped by `resolveIdentity()`'s `scopeId`; what the daily quota and
global ceiling both count against).

## Homepage: why this isn't "keyword-adaptive"

Considered and rejected: making the homepage itself change content based
on which keyword a visitor searched. Two independent reasons:

1. **Not technically possible for organic search.** Google strips the
   search query from the referrer on organic clicks (has since ~2013);
   there is no data to read that would tell a page which keyword an
   organic visitor searched.
2. **Already decided against in `docs/SEO.md`** even where the data
   *were* available — see "Declined: a 'doorway page' for misspelled
   search queries" vs. "'Insta anon' / 'story viewer anon' search
   intent — two real landing pages, not a doorway page." The accepted
   pattern is separate, real landing pages per intent, which is exactly
   what `/transcribe/{youtube,tiktok,instagram,facebook}-*` are — each
   with genuinely different lead copy, `howItWorks`, and FAQ, all funneling
   into the same real feature via a CTA to `/transcribe`.

## Explicitly out of scope this slice

File upload (needs new storage infra — `@vercel/blob` or similar —
nothing like it exists yet); an async job-queue/worker system (same
"queuing into nothing" reasoning already used to justify synchronous/
bounded exports and snapshots); SRT/VTT export and translation; speaker
diarization (supported by the chosen APIs/actors but adds UI complexity).
