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
  dead instances) — rejected in favor of "actually works." **No free
  embed-style shortcut exists here** (unlike Instagram/Facebook below) —
  tried live in a later session and confirmed this is a dead end, not an
  unexplored one: `youtube.com/embed/{id}` no longer inlines stream data
  (loaded via JS), the internal `youtubei/v1/player` API returns `LOGIN_
  REQUIRED — Sign in to confirm you're not a bot` on the WEB client and a
  `400 Precondition check failed` on the ANDROID client (both are bot/IP
  reputation blocks, not a wrong-endpoint problem), and Piped/Invidious
  instances are still dead on re-check. Unlike Instagram/Facebook, this
  isn't a "find the right hidden endpoint" gap — Google blocks datacenter
  IPs at the network level regardless of which client/endpoint is used,
  so the fix would require residential proxies (what Apify's actor
  presumably already pays for) or a full headless-browser + PoToken
  (BotGuard) solution, which is fragile, heavy to maintain, and a more
  direct ToS risk than the current Apify-actor approach. Don't
  re-research this without new information — it was checked twice.
- **Instagram** — free primary, found and confirmed live in a later
  session: Instagram's own public embed page
  (`instagram.com/reel/{code}/embed/captioned/`) is reachable with a plain
  unauthenticated request and inlines a direct, CORS-open CDN `.mp4` URL
  plus a real `video_duration` in its JSON-in-script payload (the video
  ID/shortcode is extracted from the URL locally, no external call
  needed for that). This is a genuine, verified 20x+ speedup over the
  Apify fallback: ~0.8-2.5s per reel vs. 35-54s, confirmed against
  several real public reels, and it fixes the "duration always 0" gap
  the Apify path had (that actor never returns one). Falls back to
  `thenetaji/instagram-video-downloader` (Reels/Stories) only if the
  embed page has no `video_url` (private/deleted/geo-blocked, or
  Instagram changing this markup).
- **Facebook** — free primary, same discovery applied to Facebook's
  public video embed plugin (`facebook.com/plugins/video.php?href=...`),
  which proxies whatever URL shape the user pasted (watch/?v=, /videos/,
  /reel/, share links) and inlines a direct `.mp4` (`hd_src`, falling
  back to `sd_src`) with no auth. Confirmed live: ~5s vs. 29-35s for the
  Apify path. No duration field found in this payload — left at 0
  (honest unknown), same as the Apify actor already did. Falls back to
  `apple_yang/facebook-video-audio-downloader` only if the embed plugin
  has no `hd_src`/`sd_src`.

Each downloader also returns a `videoUrl` (the same file, or a
video-specific one when audio/video are separate) used for the "watch
while it transcribes" player in the UI — not persisted to
`transcript_cache` (these are short-lived CDN/KVS links), so a cache-hit
response has no video to show.

This is genuinely parallel, not just shown after the fact: `transcribe()`
takes an optional `onVideoReady` callback (`src/lib/transcription/
index.ts`) fired the moment the download step succeeds, before the
(usually slower) Whisper call even starts. `POST /api/v1/transcribe`
turns that into its own stream event (`{stage: "transcribing", videoUrl}`,
`src/app/api/v1/transcribe/route.ts`), and the widget renders the video
player as soon as that event arrives — a user watches the actual video
while the transcript is still being produced, not only once the whole
pipeline finishes. Never fires for the YouTube-captions fast-path (no
video file is downloaded there) or when the download step itself fails.

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

## Language selection and translation

Whisper (Groq/OpenAI) auto-detects the spoken language reliably, so
`language: "auto"` is the UI default and the right choice almost always.
A manual override (`src/lib/transcription/languages.ts`'s
`TRANSCRIPTION_LANGUAGES`, ~20 common languages) exists only for the rare
case where auto-detect visibly picks the wrong language on a short or
ambiguous clip — it's passed straight through to the existing
`language` field `POST /api/v1/transcribe` already accepted (no server
change needed, only the UI was missing).

Translation is a separate, independent step (`src/lib/transcription/
translate.ts`, `POST /api/v1/translate`) — it takes already-transcribed
text and asks a chat-completion model (not Whisper) to translate it,
after the transcript exists, on demand. Same multi-key fallback shape as
`speech-to-text.ts`: every configured `GROQ_API_KEY`/`_2`/`_3` tried with
Groq's `llama-3.3-70b-versatile`, then OpenAI's `gpt-4o-mini` if all Groq
keys fail.

Two translation outputs, requested independently:
- **Plain text** — the whole transcript translated in one call. Always
  attempted, always returned if the call succeeds.
- **Timed segments** — each segment's text translated while keeping its
  original `start`/`end`, done via numbered-line batches of 50 segments
  (small batches keep the model reliably returning exactly as many lines
  as it was given). If a batch doesn't come back with exactly the right
  line count, that's caught and the timed version is silently omitted
  (`segments: []`) — the plain translated text still returns. This is an
  honest degradation, not a bug: a mistimed/misaligned subtitle would be
  worse than no timed subtitle, so `translateTranscript()` never guesses.
  Capped at 400 segments (`MAX_SEGMENTS_FOR_TIMED_TRANSLATION`) — beyond
  that, only the plain-text translation is attempted at all.

  The plain-text translation and every segment batch are fired
  **concurrently** (`Promise.all`/`allSettled`), not one after another —
  an earlier version awaited them in sequence, which meant a transcript
  needing several batches could multiply the per-call timeout by the
  batch count and blow past the 60s route budget (`maxDuration`). Running
  them in parallel bounds the whole request's latency to one call's worth
  instead, which is also why `REQUEST_TIMEOUT_MS` is 30s, not the 45s a
  single sequential call could previously afford.

Not cached (`transcript_cache` stores only the original transcript) and
not counted against the transcription daily quota — it's a much cheaper
call than a full download+Whisper run, protected only by its own looser
rate limit (`TRANSLATE_RATE_LIMIT`, `src/app/api/v1/translate/route.ts`).

UI: the "done" state shows a language-select + "Translate" control next
to the transcript; a successful translation adds an Original/Translated
tab toggle (`Tabs` from `src/components/ui/tabs.tsx`), each tab getting
its own pair of copy buttons (see below) — translating never replaces or
discards the original transcript.

## Copy buttons: plain vs. timestamped

Two independent copy actions, both available whenever segments exist
(`TranscriptBody` in `transcriber-widget.tsx`):
- **Copy text** — segments joined by spaces (or the raw `text` field when
  there are no segments), no timestamps — the version someone pastes into
  a document.
- **Copy with timestamps** — one line per segment, `[m:ss] text`, sourced
  from the same `segments` array already rendered on screen (never a
  separately-fetched or reformatted copy) — the version someone pastes
  into a video editor's subtitle timeline. Hidden entirely when there are
  no segments (nothing to copy with timestamps that doesn't exist).

## Explicitly out of scope this slice

File upload (needs new storage infra — `@vercel/blob` or similar —
nothing like it exists yet); an async job-queue/worker system (same
"queuing into nothing" reasoning already used to justify synchronous/
bounded exports and snapshots); SRT/VTT file export (the timestamped-copy
button above covers the "paste into a subtitle tool" use case without a
download endpoint); speaker diarization (supported by the chosen APIs/
actors but adds UI complexity).
