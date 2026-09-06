import type { TranscriptSegment } from "./types";

/**
 * Transcript translation (docs/TRANSCRIBER.md "Translation"). A separate
 * step from `speech-to-text.ts` — that module turns audio into text in its
 * original language; this one turns text into text in a different
 * language, via a chat-completion model rather than Whisper. Same
 * multi-Groq-key-then-OpenAI fallback shape as `speech-to-text.ts`, reusing
 * `groqKeys()`'s env vars (a Groq account's chat and audio endpoints share
 * the same API key).
 */
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// Confirmed live against this account's actual /v1/models list — Groq has
// deprecated/rotated chat models before (this replaced an earlier
// llama-3.3-70b-versatile that 404'd), so this is not a guess from docs.
const GROQ_MODEL = "openai/gpt-oss-120b";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

/** Chat-completion requests can legitimately take longer than the 20-line segment batches below on a slow provider — kept short of the 60s route budget. */
const REQUEST_TIMEOUT_MS = 45_000;

/** Above this many segments, per-segment batching (SEGMENT_BATCH_SIZE below) still applies, but a very long transcript's last batch could still push close to the function's time budget — capped as an honest "too long to time" rather than a silent partial result. */
const MAX_SEGMENTS_FOR_TIMED_TRANSLATION = 400;
/** Small batches keep each model call's expected output short enough that the model reliably returns exactly as many lines as it was given — a single 400-line request is far more likely to drift off the requested count than eight 50-line ones. */
const SEGMENT_BATCH_SIZE = 50;

function groqKeys(): string[] {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(
    (key): key is string => Boolean(key),
  );
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function chatComplete(url: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`chat completion failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty completion response");
  return content;
}

/** Same "try every Groq key, then OpenAI" shape as `transcribeAudio` in speech-to-text.ts. */
async function completeWithFallback(systemPrompt: string, userPrompt: string): Promise<{ content: string; provider: "groq" | "openai" }> {
  let lastError: unknown;
  for (const key of groqKeys()) {
    try {
      const content = await chatComplete(GROQ_CHAT_URL, key, GROQ_MODEL, systemPrompt, userPrompt);
      return { content, provider: "groq" };
    } catch (error) {
      lastError = error;
      console.warn("[translation] a Groq key failed, trying next:", error);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { content: await chatComplete(OPENAI_CHAT_URL, openaiKey, OPENAI_MODEL, systemPrompt, userPrompt), provider: "openai" };
  }

  if (lastError) throw lastError;
  throw new Error("No GROQ_API_KEY (or OPENAI_API_KEY) is set — required for translation.");
}

function parseNumberedLines(response: string, expectedCount: number): string[] | null {
  const lines = response
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 0);
  return lines.length === expectedCount ? lines : null;
}

/**
 * Translates a batch of segment texts, preserving order and count via
 * numbered-line prompting. Returns `null` (not a throw) if the model's
 * output doesn't come back with exactly one line per input — the caller
 * treats that as "timed translation not available for this batch", never
 * fabricating or misaligning timestamps.
 */
async function translateSegmentBatch(texts: string[], targetLanguageLabel: string): Promise<string[] | null> {
  const numbered = texts.map((text, i) => `${i + 1}. ${text}`).join("\n");
  const { content } = await completeWithFallback(
    `You are a professional subtitle translator. Translate each numbered line into ${targetLanguageLabel}. Output EXACTLY ${texts.length} lines, one translated line per input line, in the same order, each still prefixed with its original number. No extra commentary, no blank lines.`,
    numbered,
  );
  return parseNumberedLines(content, texts.length);
}

export interface TranslationResult {
  text: string;
  /** Empty when segment-level translation wasn't possible (batch count mismatch, or too many segments) — an honest degradation, not a bug (docs/TRANSCRIBER.md). */
  segments: TranscriptSegment[];
  provider: "groq" | "openai";
}

/**
 * Translates the full transcript text (always attempted) and, best-effort,
 * a segment-level translation that preserves each segment's original
 * start/end (docs/TRANSCRIBER.md "Translation"). The two are independent:
 * a failed segment batch never fails the whole request, since the plain
 * translated text is already useful on its own.
 */
export async function translateTranscript(
  text: string,
  segments: TranscriptSegment[],
  targetLanguageLabel: string,
): Promise<TranslationResult> {
  const { content: translatedText, provider } = await completeWithFallback(
    `You are a professional subtitle translator. Translate the user's text into ${targetLanguageLabel}. Preserve meaning, tone, and paragraph breaks. Output ONLY the translated text — no notes, no quotes, no preamble.`,
    text,
  );

  let translatedSegments: TranscriptSegment[] = [];
  if (segments.length > 0 && segments.length <= MAX_SEGMENTS_FOR_TIMED_TRANSLATION) {
    try {
      const translatedTexts: string[] = [];
      for (let i = 0; i < segments.length; i += SEGMENT_BATCH_SIZE) {
        const batch = segments.slice(i, i + SEGMENT_BATCH_SIZE);
        const translated = await translateSegmentBatch(
          batch.map((s) => s.text),
          targetLanguageLabel,
        );
        if (!translated) throw new Error("segment batch count mismatch");
        translatedTexts.push(...translated);
      }
      translatedSegments = segments.map((s, i) => ({ start: s.start, end: s.end, text: translatedTexts[i] }));
    } catch (error) {
      console.warn("[translation] timed segment translation unavailable, falling back to plain text only:", error);
    }
  }

  return { text: translatedText.trim(), segments: translatedSegments, provider };
}
