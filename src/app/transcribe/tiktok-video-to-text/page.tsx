import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";

const TITLE = "TikTok video to text";
const DESCRIPTION = "Paste a public TikTok video link and get a text transcript of what's said, in seconds.";
const PATH = "/transcribe/tiktok-video-to-text";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const FAQ = [
  {
    question: "Do I need the TikTok app or a download link?",
    answer: "No — just the video's share/watch URL from tiktok.com. The video itself is never shown or hosted here, only its transcript.",
  },
  {
    question: "Does it work on TikToks with music instead of speech?",
    answer: "A music-only clip with no spoken words will honestly show \"no speech detected\" rather than a fabricated transcript.",
  },
  {
    question: "What languages are supported?",
    answer: "Speech-to-text auto-detects the spoken language, with 90+ languages supported.",
  },
];

export default function TiktokVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-tiktok-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-tiktok-transcript-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste any public TikTok video link and get back exactly what's said — as searchable, copyable text."
        primaryCta={{ href: "/transcribe", label: "Transcribe a TikTok video" }}
        howItWorks={[
          "Copy a public TikTok video's share link.",
          "Paste it into the transcriber.",
          "Read or copy the resulting transcript.",
        ]}
        features={[
          { title: "Link-based, no app needed", body: "Works from the tiktok.com URL alone." },
          { title: "90+ languages", body: "Auto-detected spoken language, transcribed accordingly." },
          { title: "Honest empty states", body: "Music-only or silent clips are labeled as having no speech, never guessed at." },
          { title: "Free daily use", body: "No sign-up required for a limited number of transcriptions per day." },
        ]}
        limitations={[
          "Private accounts and region-restricted videos can't be transcribed.",
          "Videos longer than 30 minutes aren't supported yet.",
          "Speech-to-text accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "The same transcriber for Instagram Reels." },
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
