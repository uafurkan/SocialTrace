import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram Reel to text";
const DESCRIPTION =
  "Paste a public Instagram Reel or video post link and get a text transcript of its audio. Works with instagram.com/reel/, /p/, and /tv/ links.";
const PATH = "/transcribe/instagram-reel-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public Reel or video post link: instagram.com/reel/, /p/, or /tv/.",
  "Paste it into the transcriber.",
  "Copy the plain text, or the version with timestamps.",
];

const FAQ = [
  {
    question: "Does this work on video posts, not just Reels?",
    answer:
      "Yes. /p/ and /tv/ links to public video posts work too. A photo-only post has no audio, so there is nothing to transcribe.",
  },
  {
    question: "Can I transcribe a private account's Reel?",
    answer:
      "No. Only public content can be transcribed, the same public-data-only rule as the rest of SocialTrace.",
  },
  {
    question: "How long does it take?",
    answer:
      "Short Reels usually come back within seconds. Longer videos take longer, because speech-to-text runs over the whole audio.",
  },
];

export default function InstagramReelToTextPage() {
  return (
    <>
      <JsonLd id="ld-reel-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-reel-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-reel-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-reel-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public Instagram Reel or video post link and get a text transcript of the audio."
        widget={<TranscriberWidget platformHint="Instagram" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          {
            title: "Reel, post, and IGTV links",
            body: "instagram.com/reel/, /p/, and /tv/ links are read. Other Instagram URLs may not work.",
          },
          {
            title: "Fast for public pages",
            body: "The video is read from Instagram's public embed page, which usually takes a few seconds.",
          },
          {
            title: "Honest empty results",
            body: "A video with no detectable speech is reported as such, not filled with invented text.",
          },
          {
            title: "Plain text or timestamps",
            body: "Copy the transcript as plain text, or with timestamps.",
          },
        ]}
        limitations={[
          "Private accounts can't be transcribed. Only public content works.",
          "Videos longer than 45 minutes aren't supported yet.",
          "Accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-reels-viewer", label: "Instagram reels viewer", body: "Browse a public profile's latest reels." },
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok links." },
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
