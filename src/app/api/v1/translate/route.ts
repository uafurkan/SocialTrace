import { NextRequest, NextResponse } from "next/server";

import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { TRANSLATION_TARGET_LANGUAGES } from "@/lib/transcription/languages";
import { translateTranscript } from "@/lib/transcription/translate";
import type { TranscriptSegment } from "@/lib/transcription/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Looser than /api/v1/transcribe's limit (docs/TRANSCRIBER.md) since a
// translation is much cheaper than a full download+Whisper pipeline run —
// still capped to keep a runaway client from hammering the chat-completion
// providers for free.
const TRANSLATE_RATE_LIMIT = 20;
const TRANSLATE_RATE_WINDOW_MS = 10 * 60 * 1000;

const MAX_TEXT_LENGTH = 20_000;

function isSegmentArray(value: unknown): value is TranscriptSegment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as TranscriptSegment).start === "number" &&
        typeof (item as TranscriptSegment).end === "number" &&
        typeof (item as TranscriptSegment).text === "string",
    )
  );
}

export async function POST(request: NextRequest) {
  const rate = await rateLimit(`translate:${clientIdentifierFor(request)}`, TRANSLATE_RATE_LIMIT, TRANSLATE_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const segmentsInput = isSegmentArray(body?.segments) ? body.segments : [];
  const targetCode = typeof body?.targetLanguage === "string" ? body.targetLanguage : "";
  const target = TRANSLATION_TARGET_LANGUAGES.find((language) => language.code === targetCode);

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "This transcript is too long to translate in one request." }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json({ error: "targetLanguage is not supported" }, { status: 400 });
  }

  try {
    const result = await translateTranscript(text, segmentsInput, target.label);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    console.error("[translate] failed:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
