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

async function transcribeWith(
  baseUrl: string,
  apiKey: string,
  model: string,
  provider: "groq" | "openai",
  audioBlob: Blob,
  language?: string,
): Promise<SpeechToTextResult> {
  const form = new FormData();
  form.append("file", audioBlob, "audio.mp3");
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
 * Groq primary (9x cheaper than OpenAI's own endpoint, generous free
 * tier — docs/TRANSCRIBER.md), OpenAI Whisper as the fallback only when
 * Groq itself errors (down, rate-limited, key missing) — mirrors
 * `runApifyActor`'s "try primary, fall back on a real failure" shape.
 * Both unconfigured (no keys at all) throws immediately, same
 * "opt-in real integration" pattern as every other provider in this app.
 */
export async function transcribeAudio(audioBlob: Blob, language?: string): Promise<SpeechToTextResult> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey) {
    try {
      return await transcribeWith(GROQ_URL, groqKey, GROQ_MODEL, "groq", audioBlob, language);
    } catch (error) {
      if (!openaiKey) throw error;
      console.warn("[transcription] Groq failed, falling back to OpenAI:", error);
    }
  }

  if (openaiKey) {
    return await transcribeWith(OPENAI_URL, openaiKey, OPENAI_MODEL, "openai", audioBlob, language);
  }

  throw new Error("Neither GROQ_API_KEY nor OPENAI_API_KEY is set — required for transcription.");
}
