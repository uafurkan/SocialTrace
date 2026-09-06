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

interface VerboseJsonResponse {
  text?: string;
  language?: string;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
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
  const segments: TranscriptSegment[] = (data.segments ?? []).map((s) => ({
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: (s.text ?? "").trim(),
  }));

  return {
    text: (data.text ?? "").trim(),
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
