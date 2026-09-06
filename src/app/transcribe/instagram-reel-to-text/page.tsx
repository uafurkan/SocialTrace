import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";

const TITLE = "Instagram Reel to text";
const DESCRIPTION = "Paste a public Instagram Reel or video post link and get a text transcript of the audio.";
const PATH = "/transcribe/instagram-reel-to-text";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const FAQ = [
  {
    question: "Does this work on regular Instagram video posts, not just Reels?",
    answer: "Yes — any public instagram.com video link works, Reels included.",
  },
  {
    question: "Can I transcribe a private account's Reel?",
    answer: "No — only public content can be transcribed, the same public-data-only rule as the rest of SocialTrace.",
  },
  {
    question: "How long does it take?",
    answer: "Typically a few seconds to under a minute, depending on the video's length.",
  },
];

export default function InstagramReelToTextPage() {
  return (
    <>
      <JsonLd id="ld-instagram-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-instagram-transcript-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public Instagram Reel or video post link and get back a text transcript of the audio."
        primaryCta={{ href: "/transcribe", label: "Transcribe an Instagram video" }}
        howItWorks={[
          "Copy a public Instagram Reel or video post's link.",
          "Paste it into the transcriber.",
          "Read or copy the resulting transcript.",
        ]}
        features={[
          { title: "Reels and video posts", body: "Any public instagram.com video link works." },
          { title: "90+ languages", body: "Auto-detected spoken language, transcribed accordingly." },
          { title: "Honest empty states", body: "Music-only or silent clips are labeled as having no speech, never guessed at." },
          { title: "Free daily use", body: "No sign-up required for a limited number of transcriptions per day." },
        ]}
        limitations={[
          "Private accounts can't be transcribed — only public content.",
          "Videos longer than 30 minutes aren't supported yet.",
          "Speech-to-text accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok links." },
          { href: "/tools/anonymous-instagram-viewer", label: "Anonymous Instagram viewer", body: "Browse a public Instagram profile's posts, reels, and stories." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
