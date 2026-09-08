import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Facebook video to text";
const DESCRIPTION = "Paste a public Facebook video or Reel link and get a text transcript of the audio.";
const PATH = "/transcribe/facebook-video-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public Facebook video's link (facebook.com or fb.watch).",
  "Paste it into the transcriber.",
  "Read or copy the resulting transcript.",
];

const FAQ = [
  {
    question: "Does this work on Facebook Watch videos and Reels?",
    answer: "Yes — any public facebook.com or fb.watch video link works.",
  },
  {
    question: "Can I transcribe a video from a private group or profile?",
    answer: "No — only public videos can be transcribed.",
  },
  {
    question: "What languages are supported?",
    answer: "Speech-to-text auto-detects the spoken language, with 90+ languages supported.",
  },
];

export default function FacebookVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-facebook-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-facebook-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-facebook-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-facebook-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public Facebook video, Watch, or Reel link and get back a text transcript of the audio."
        widget={<TranscriberWidget platformHint="Facebook" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          { title: "Watch and Reels", body: "Any public facebook.com or fb.watch video link works." },
          { title: "90+ languages", body: "Auto-detected spoken language, transcribed accordingly." },
          { title: "Honest empty states", body: "Music-only or silent clips are labeled as having no speech, never guessed at." },
          { title: "Free daily use", body: "No sign-up required for a limited number of transcriptions per day." },
        ]}
        limitations={[
          "Private groups, profiles, and region-restricted videos can't be transcribed.",
          "Videos longer than 30 minutes aren't supported yet.",
          "Speech-to-text accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "Transcribe public Instagram Reels." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
