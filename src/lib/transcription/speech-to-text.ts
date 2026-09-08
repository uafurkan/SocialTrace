import type { TranscriptSegment } from "./types";

/**
 * Groq's Whisper endpoint is OpenAI-API-compatible (same request/response
 * shape as OpenAI's own `/v1/audio/transcriptions`), which is exactly why
 * OpenAI Whisper is a clean fallback here rather than a separate code
 * path — same request builder, different base URL/model/key.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_MODEL = "whisper-1";

interface VerboseJsonSegment {
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
}

interface VerboseJsonResponse {
  text?: string;
  language?: string;
  segments?: VerboseJsonSegment[];
}

/**
 * Whisper hallucinates plausible-sounding but content-unrelated text on
 * quiet/music-only/unclear audio instead of returning nothing — confirmed
 * live this session (an Arabic news clip transcribed as "Thank you.", a
 * Spanish clip as a looped "Jessica! Jessica! Jessica!..."). Both slipped
 * straight past the existing `if (!result.text)` empty-transcript check
 * (src/lib/transcription/index.ts) since the hallucinated text isn't
 * empty — it's confidently wrong.
 *
 * This isn't something we have to guess how to detect: it's the exact
 * problem OpenAI's own reference decoder (openai/whisper `decoding.py`,
 * `DecodingOptions` defaults) and its widely-used derivatives
 * (faster-whisper's `no_speech_threshold`/`log_prob_threshold`/
 * `compression_ratio_threshold`, whisper.cpp) already solve internally
 * during decoding — Groq/OpenAI's hosted HTTP API doesn't expose a
 * "suppress hallucinations" toggle, but `response_format=verbose_json`
 * (already requested below) returns the same per-segment confidence
 * metrics those decoders use (`avg_logprob`, `no_speech_prob`,
 * `compression_ratio`), so the identical heuristic can be replicated
 * post-hoc on the response:
 *   - `no_speech_prob` high AND `avg_logprob` low -> the model itself
 *     flagged this stretch as probable silence/non-speech, but emitted
 *     filler text anyway instead of nothing.
 *   - `compression_ratio` high -> the segment's text is highly
 *     repetitive (compresses well), the signature of a decoding loop
 *     ("Jessica! Jessica! Jessica!...").
 * (Commercial STT vendors like ElevenLabs Scribe take a related but
 * distinct approach — per-word confidence scores plus explicit
 * non-speech/audio-event tagging from a differently-trained acoustic
 * model — which isn't available through Whisper's API at all; the
 * segment-metadata heuristic below is the closest equivalent Whisper's
 * own API surface actually exposes.)
 */
const NO_SPEECH_PROB_THRESHOLD = 0.6;
const LOGPROB_THRESHOLD = -1.0;
const COMPRESSION_RATIO_THRESHOLD = 2.4;

/**
 * Backstop for when segment-level metadata is missing or doesn't catch
 * it: a short list of stock filler/outro lines Whisper is well known to
 * hallucinate (baked into its training data from captioned videos) when
 * given quiet/unclear audio. Matched only against the *entire* transcript
 * when short, never mid-sentence — a video that genuinely ends with
 * "thank you for watching" in context is untouched.
 */
const HALLUCINATION_PHRASES = new Set([
  "thank you",
  "thank you.",
  "thanks for watching",
  "thanks for watching!",
  "please subscribe",
  "like and subscribe",
  "subscribe to my channel",
  "bye bye",
  "bye-bye",
  "the end",
  "www.opensubtitles.org",
  "amara.org",
  "subtitles by the amara.org community",
]);

/** Second backstop: a single word/token dominating the transcript ("Jessica! Jessica! Jessica!...") is the textbook Whisper decoding-loop hallucination, independent of whether `compression_ratio` was present in the response. */
function isRepetitionLoop(text: string): boolean {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length < 6) return false;
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return maxCount / words.length > 0.4;
}

function isHallucinatedSegment(segment: VerboseJsonSegment): boolean {
  const noSpeech = segment.no_speech_prob ?? 0;
  const logprob = segment.avg_logprob ?? 0;
  const compression = segment.compression_ratio ?? 0;
  const looksLikeSilence = noSpeech > NO_SPEECH_PROB_THRESHOLD && logprob < LOGPROB_THRESHOLD;
  const looksLikeRepetitionLoop = compression > COMPRESSION_RATIO_THRESHOLD;
  return looksLikeSilence || looksLikeRepetitionLoop;
}

export interface SpeechToTextResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  provider: "groq" | "openai";
}

/** Whisper endpoints pick their decoder off the filename extension, not the real bytes — sending an mp4/webm file named "audio.mp3" makes some requests fail to decode. Downloaders here return mp4 (YouTube/Instagram/TikTok) or mpeg audio (Facebook), so the extension has to match `audioBlob.type`. */
function extensionFor(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("m4a") || contentType.includes("mp4a")) return "m4a";
  if (contentType.includes("opus") || contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mpeg")) return "mp3";
  return "mp3";
}

async function transcribeWith(
  baseUrl: string,
  apiKey: string,
  model: string,
  provider: "groq" | "openai",
  audioBlob: Blob,
  language?: string,
): Promise<SpeechToTextResult> {
  const form = new FormData();
  form.append("file", audioBlob, `audio.${extensionFor(audioBlob.type)}`);
  form.append("model", model);
  form.append("response_format", "verbose_json");
  if (language) form.append("language", language);

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider} transcription failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as VerboseJsonResponse;
  const rawSegments = data.segments ?? [];

  let segments: TranscriptSegment[];
  let text: string;
  if (rawSegments.length > 0) {
    // Per-segment confidence metadata is present — drop segments Whisper's
    // own decoder would have suppressed as hallucinated (see comment above
    // `isHallucinatedSegment`) and rebuild the transcript from what's left,
    // rather than trusting the top-level `text` field (which the API
    // computes independently and may still include a dropped segment's
    // hallucinated content).
    segments = rawSegments
      .filter((s) => !isHallucinatedSegment(s))
      .map((s) => ({ start: s.start ?? 0, end: s.end ?? 0, text: (s.text ?? "").trim() }));
    text = segments.map((s) => s.text).join(" ").trim();
  } else {
    // No segment metadata to filter on (shouldn't normally happen with
    // verbose_json, but don't silently lose a real transcript over it) —
    // fall through to the whole-text backstop checks below.
    text = (data.text ?? "").trim();
    segments = [];
  }

  const normalized = text.toLowerCase().trim();
  if (text && (isRepetitionLoop(text) || HALLUCINATION_PHRASES.has(normalized))) {
    console.warn(`[transcription] discarding likely Whisper hallucination from ${provider}: "${text.slice(0, 120)}"`);
    text = "";
    segments = [];
  }

  return {
    text,
    segments,
    language: data.language ?? language ?? "auto",
    provider,
  };
}

/**
 * Groq's free tier caps requests/audio-seconds per day *per key* — so
 * multiple Groq keys (round-robin on failure) buys more free daily
 * capacity than a single key, before ever touching a paid fallback.
 * `GROQ_API_KEY` is required; `GROQ_API_KEY_2`/`GROQ_API_KEY_3` are
 * optional extra keys tried in order after the first one errors
 * (rate-limited, down, etc.) — same "try next" shape as the Apify
 * follower-scraper fallback chain.
 */
function groqKeys(): string[] {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(
    (key): key is string => Boolean(key),
  );
}

/**
 * Groq primary (9x cheaper than OpenAI's own endpoint, generous free
 * tier — docs/TRANSCRIBER.md), tried across every configured Groq key
 * before falling back to OpenAI Whisper (only reached once all Groq keys
 * error) — mirrors `runApifyActor`'s "try primary, fall back on a real
 * failure" shape. Nothing configured at all throws immediately, same
 * "opt-in real integration" pattern as every other provider in this app.
 */
export async function transcribeAudio(audioBlob: Blob, language?: string): Promise<SpeechToTextResult> {
  const keys = groqKeys();
  const openaiKey = process.env.OPENAI_API_KEY;

  let lastError: unknown;
  for (const key of keys) {
    try {
      return await transcribeWith(GROQ_URL, key, GROQ_MODEL, "groq", audioBlob, language);
    } catch (error) {
      lastError = error;
      console.warn("[transcription] a Groq key failed, trying next:", error);
    }
  }

  if (openaiKey) {
    return await transcribeWith(OPENAI_URL, openaiKey, OPENAI_MODEL, "openai", audioBlob, language);
  }

  if (lastError) throw lastError;
  throw new Error("No GROQ_API_KEY (or OPENAI_API_KEY) is set — required for transcription.");
}
