# Video Transcriber

A second, independent product surface (`/transcribe`) alongside
SocialTrace's Instagram-analytics identity: paste a public YouTube,
TikTok, Instagram, or Facebook video link and get a text transcript back.
Link-only in this slice — file upload is a documented future slice, not
built yet (`transcript_platform`'s `"upload"` enum value is reserved for
it).

## Why a unified pipeline, not per-platform actors

The transcription step is one shared code path regardless of platform;
only the *download* step is platform-specific (see below).

```
resolveAudioSource(url)
  - YouTube: try official timedtext captions first (free, instant)
  - Otherwise: a per-platform download step (see "Download step" below)

transcribeAudio(audioUrl, language?)
  - Primary: Groq whisper-large-v3-turbo (9x cheaper than OpenAI's own
    endpoint, ~15s to transcribe an hour of audio, generous free tier)
  - Fallback: OpenAI Whisper API, only if Groq itself errors/rate-limits
```

See `src/lib/transcription/index.ts`.

## Download step: per-platform, not universal (revised)

A single yt-dlp-based "universal" actor
(`reinventingai/video-or-audio-downloader`) was the original design —
one actor, one input shape, covering all four platforms. **This broke in
production**: YouTube and Instagram now actively block raw yt-dlp
(running from any cloud/datacenter IP, not just Apify's) with a 403 /
"login required" error — confirmed live against this exact actor during
the fix in this slice. TikTok was unaffected.

The free YouTube captions fast-path was *also* found broken during this
fix: YouTube's `timedtext` endpoint now returns an empty body for every
format (`json3`, `srv1`, `srv3`, `vtt`, no `fmt` at all) even when a
`captionTracks` entry is found on the watch page — verified live, not
assumed. The code still tries it first (free, and this may loosen again),
but every video currently falls through to the paid path below.

Current download step, one function per platform in
`src/lib/transcription/downloader.ts`, each confirmed live against a real
public video this session:

- **TikTok** — free primary: `tikwm.com`, the same no-auth unofficial API
  behind most free TikTok-downloader sites, returns a watermark-free
  video URL + duration at no Apify cost. Falls back to the yt-dlp actor
  (still reliable for TikTok specifically) only if tikwm is down.
- **YouTube** — `streamers/youtube-video-downloader` (398K+ runs). Slow:
  ~54s for a 3.5-minute video in live testing, which is uncomfortably
  close to the 60s serverless budget (`maxDuration`, `MAX_VIDEO_DURATION_SECONDS`)
  once the rest of the pipeline (blob fetch, Whisper call, DB write) is
  added — an accepted, documented risk, not a fixed one; a longer video
  can realistically time out. Public free alternatives (Piped/Invidious
  instances) were tried live and were unreliable (401s, empty bodies,
  dead instances) — rejected in favor of "actually works."
- **Instagram** — `thenetaji/instagram-video-downloader` (Reels/Stories).
  No working no-auth free API was found for Instagram this session.
- **Facebook** — `apple_yang/facebook-video-audio-downloader`, returning
  a direct Facebook CDN file — the only actor found (across two sessions
  of searching) that does.

Each downloader also returns a `videoUrl` (the same file, or a
video-specific one when audio/video are separate) used purely for the
"watch while it transcribes" player in the UI — not persisted to
`transcript_cache` (these are short-lived CDN/KVS links), so a cache-hit
response has no video to show.

If the download step succeeds but speech-to-text fails, a last-resort
independent all-in-one actor (`tictechid/anoxvanzi-transcriber`) is
tried before giving up. As of this session **that actor's free tier is
exhausted** (5-use cap already used) and needs an Apify paid plan to run
again — it's still wired in and fails safely (returns `null`, not a
throw) but currently never actually helps. Its output has no
per-segment timestamps when it does work, so a fallback-actor result
comes back with `segments: []` — an honest degradation, not a bug.

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
