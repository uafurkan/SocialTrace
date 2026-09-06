/**
 * Video transcriber domain types (docs/TRANSCRIBER.md). Deliberately
 * separate from `src/lib/domain/types.ts` (SocialDataProvider's models) —
 * this feature has nothing to do with Instagram profiles/posts, it's a
 * second, independent product surface on the same site.
 */
export type TranscriptPlatform = "youtube" | "tiktok" | "instagram" | "facebook";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  durationSeconds: number;
  platform: TranscriptPlatform;
  /** Which step actually produced this: "youtube_captions" | "groq" | "openai" | an actor id — for observability, not shown to the user. */
  provider: string;
  /**
   * A real playable file for "watch while you read the transcript" — only
   * populated on a fresh (non-cached) run, since these are short-lived CDN/
   * KVS URLs (not persisted to `transcript_cache`, so a cache-hit response
   * has no video to show — an honest gap, not a bug: re-running the
   * pipeline is the only way to get a fresh playable URL again).
   */
  videoUrl?: string | null;
}

export type TranscriptionErrorReason =
  | "unsupported_url"
  | "private_or_restricted"
  | "no_speech"
  | "too_long"
  | "download_failed"
  | "transcription_failed";

/**
 * Mirrors `ProfileNotFoundError`'s pattern (src/lib/providers/types.ts):
 * a typed reason the UI switches on, never a raw error string — the
 * data-honesty convention `NotAvailable`/`CoverageBadge` already use.
 */
export class TranscriptionError extends Error {
  constructor(
    public readonly reason: TranscriptionErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}
