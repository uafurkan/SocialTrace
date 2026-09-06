import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";

const TITLE = "YouTube transcript generator";
const DESCRIPTION = "Paste a YouTube video link and get a text transcript — pulled from its existing captions when available, or generated with speech-to-text otherwise.";
const PATH = "/transcribe/youtube-transcript-generator";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const FAQ = [
  {
    question: "Does this use YouTube's own captions?",
    answer:
      "When a video already has manual or auto-generated captions, the transcript is pulled directly from them — free and near-instant. If a video has no captions at all, speech-to-text is used instead.",
  },
  {
    question: "Does it work on videos without captions?",
    answer: "Yes — speech-to-text (90+ languages) runs automatically when official captions aren't available.",
  },
  {
    question: "What about YouTube Shorts?",
    answer: "Yes, Shorts links work the same way as regular YouTube video links.",
  },
];

export default function YoutubeTranscriptGeneratorPage() {
  return (
    <>
      <JsonLd id="ld-yt-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-yt-transcript-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste any public YouTube video or Shorts link. Existing captions are used when available for an instant result; otherwise the audio is transcribed directly."
        primaryCta={{ href: "/transcribe", label: "Transcribe a YouTube video" }}
        howItWorks={[
          "Copy a public YouTube video or Shorts link.",
          "Paste it into the transcriber.",
          "Read or copy the resulting transcript, with timestamps when captions were used.",
        ]}
        features={[
          { title: "Captions fast-path", body: "Existing captions are read directly — no waiting, no re-transcription." },
          { title: "Speech-to-text fallback", body: "Videos without captions are transcribed automatically instead." },
          { title: "90+ languages", body: "Auto-detected by default, with 90+ languages supported for speech-to-text." },
          { title: "Free daily use", body: "No sign-up required for a limited number of transcriptions per day." },
        ]}
        limitations={[
          "Private, unlisted-behind-a-login, or region-restricted videos can't be transcribed.",
          "Videos longer than 30 minutes aren't supported yet.",
          "Speech-to-text accuracy drops with heavy background noise or overlapping speakers.",
        ]}
        relatedTools={[
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok links." },
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "Transcribe public Instagram Reels." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
