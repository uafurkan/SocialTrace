import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "X (Twitter) video to text";
const DESCRIPTION = "Paste a public X or Twitter video link and get a text transcript of what's said, in seconds.";
const PATH = "/transcribe/twitter-video-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public post's link from x.com or twitter.com.",
  "Paste it into the transcriber.",
  "Read or copy the resulting transcript.",
];

const FAQ = [
  {
    question: "Does this work with both x.com and twitter.com links?",
    answer: "Yes — either domain works the same way, since they're the same platform.",
  },
  {
    question: "Do I need an X account to use this?",
    answer: "No — just the post's public link. The video itself is never shown or hosted here, only its transcript.",
  },
  {
    question: "Does it work on quote posts or replies with video?",
    answer: "Yes, as long as the link points directly to the post containing the video and that post is public.",
  },
  {
    question: "What languages are supported?",
    answer: "Speech-to-text auto-detects the spoken language, with 90+ languages supported.",
  },
];

export default function TwitterVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-twitter-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-twitter-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-twitter-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-twitter-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste any public X (Twitter) video link and get back exactly what's said — as searchable, copyable text."
        widget={<TranscriberWidget platformHint="X (Twitter)" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          { title: "Works with x.com and twitter.com", body: "Either domain resolves the same way — no need to convert the link first." },
          { title: "90+ languages", body: "Auto-detected spoken language, transcribed accordingly." },
          { title: "Honest empty states", body: "Music-only or silent clips are labeled as having no speech, never guessed at." },
          { title: "Free daily use", body: "No sign-up required for a limited number of transcriptions per day." },
        ]}
        limitations={[
          "Protected (private) accounts and deleted posts can't be transcribed.",
          "Videos longer than 45 minutes aren't supported yet.",
          "Speech-to-text accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok." },
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
