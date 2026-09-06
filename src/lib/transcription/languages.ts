/**
 * Shared language list for the transcriber UI (docs/TRANSCRIBER.md).
 *
 * Codes match what Whisper (Groq/OpenAI) accepts as an explicit `language`
 * override — used two ways: (1) an optional pre-transcription hint, "auto"
 * being the default and normally-correct choice since Whisper's own
 * language detection is reliable; a user only needs to override it when
 * auto-detect visibly picks the wrong language (e.g. a short/ambiguous
 * clip); (2) the post-transcription "Translate to" target, which excludes
 * "auto" since a translation always needs a real target language.
 */
export interface LanguageOption {
  code: string;
  label: string;
}

export const TRANSCRIPTION_LANGUAGES: LanguageOption[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "id", label: "Indonesian" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "uk", label: "Ukrainian" },
];

export const TRANSLATION_TARGET_LANGUAGES: LanguageOption[] = TRANSCRIPTION_LANGUAGES.filter(
  (language) => language.code !== "auto",
);
