import { downloadAudio } from "./downloader";
import { tryFallbackActor } from "./fallback-actor";
import { detectPlatform, normalizeVideoUrl } from "./platform";
import { transcribeAudio } from "./speech-to-text";
import { TranscriptionError, type TranscriptResult } from "./types";
import { extractYouTubeVideoId, tryYouTubeCaptions } from "./youtube-captions";

/** Hard cap protecting the ~60s serverless budget and unbounded Apify/Groq spend (docs/TRANSCRIBER.md bad-outcome #6). */
export const MAX_VIDEO_DURATION_SECONDS = 30 * 60;

export { detectPlatform, normalizeVideoUrl };
export type { TranscriptResult };
export { TranscriptionError };

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio (${res.status})`);
  return await res.blob();
}

/**
 * The one function every route/page calls — same role `provider` plays
 * for `SocialDataProvider` (src/lib/providers/index.ts). Orchestrates the
 * unified pipeline (docs/TRANSCRIBER.md): YouTube captions fast-path,
 * then universal downloader + Groq/OpenAI, then the all-in-one actor as
 * a last resort. Every failure exit is a typed `TranscriptionError` —
 * callers never see a raw error message.
 *
 * `onVideoReady`, if given, fires once right after the download step
 * succeeds — before the (often slower) transcription step starts — so a
 * caller streaming progress to the client (POST /api/v1/transcribe) can
 * let the user start watching the actual video while it's still being
 * transcribed, not only once the whole pipeline finishes. Never fires for
 * the YouTube-captions fast-path (no video file is downloaded there) or
 * when the download step fails.
 */
export async function transcribe(
  sourceUrl: string,
  language?: string,
  onVideoReady?: (videoUrl: string) => void,
): Promise<TranscriptResult> {
  const platform = detectPlatform(sourceUrl);
  if (!platform) {
    throw new TranscriptionError("unsupported_url", "This link isn't from a supported platform (YouTube, TikTok, Instagram, or Facebook).");
  }

  if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(sourceUrl);
    if (videoId) {
      try {
        const captions = await tryYouTubeCaptions(videoId, language);
        if (captions) return captions;
      } catch (error) {
        // Captions fast-path failing (network blip, page shape change) isn't
        // fatal — fall through to the paid pipeline below rather than fail
        // the whole request over a free-path hiccup.
        console.warn("[transcription] YouTube captions fast-path failed, falling back:", error);
      }
    }
  }

  const downloaded = await downloadAudio(sourceUrl, platform).catch((error) => {
    console.warn("[transcription] downloader actor failed:", error);
    return null;
  });
  // Tracked separately from `downloaded` so the final error message is
  // honest: a successful download followed by a transcription failure is
  // a different, non-"private/restricted" problem (bad-outcome table,
  // docs/TRANSCRIBER.md) — e.g. no GROQ_API_KEY/OPENAI_API_KEY configured,
  // or both speech-to-text providers down.
  const downloadSucceeded = Boolean(downloaded);

  if (downloaded) {
    if (downloaded.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      throw new TranscriptionError(
        "too_long",
        `This video is longer than the ${MAX_VIDEO_DURATION_SECONDS / 60}-minute limit for transcription.`,
      );
    }
    try {
      if (downloaded.videoUrl) onVideoReady?.(downloaded.videoUrl);
      const audioBlob = await fetchAsBlob(downloaded.audioUrl);
      const result = await transcribeAudio(audioBlob, language);
      if (!result.text) {
        throw new TranscriptionError("no_speech", "No speech was detected in this video.");
      }
      return {
        text: result.text,
        segments: result.segments,
        language: result.language,
        durationSeconds: downloaded.durationSeconds,
        platform,
        provider: result.provider,
        videoUrl: downloaded.videoUrl,
      };
    } catch (error) {
      if (error instanceof TranscriptionError) throw error;
      console.warn("[transcription] speech-to-text failed after successful download, trying fallback actor:", error);
    }
  }

  const fallback = await tryFallbackActor(sourceUrl, platform).catch((error) => {
    console.warn("[transcription] fallback actor failed:", error);
    return null;
  });
  if (fallback) return fallback;

  if (downloadSucceeded) {
    throw new TranscriptionError(
      "transcription_failed",
      "The video downloaded fine, but transcription failed. Please try again shortly.",
    );
  }
  throw new TranscriptionError(
    "download_failed",
    "Couldn't access this video — it may be private, deleted, or region-restricted.",
  );
}
