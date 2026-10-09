import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "TikTok video to text";
const DESCRIPTION =
  "Paste a public TikTok video link and get a text transcript of what's said in it, to search, copy, or read. Music-only clips are reported as having no speech.";
const PATH = "/transcribe/tiktok-video-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public TikTok video link from tiktok.com.",
  "Paste it into the transcriber.",
  "Copy the plain text, or the version with timestamps.",
];

const FAQ = [
  {
    question: "Do I need the TikTok app or a download link?",
    answer:
      "No. Paste the video's link from tiktok.com. The video is not stored here. While the transcript is made, the video can play on the page if its file can be fetched.",
  },
  {
    question: "What happens with a TikTok that has music but no speech?",
    answer:
      "The tool reports that no speech was detected instead of inventing a transcript.",
  },
  {
    question: "Is the spoken language detected automatically?",
    answer:
      "Yes, unless you choose a language in the tool. The list of languages you can pick is shown in the tool.",
  },
];

export default function TikTokVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-tiktok-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-tiktok-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-tiktok-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-tiktok-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public TikTok video link and get back what's said in it, as text you can search and copy."
        widget={<TranscriberWidget platformHint="TikTok" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          {
            title: "Works from the link",
            body: "A tiktok.com video link is all the tool needs. No app or account is involved.",
          },
          {
            title: "Preview while it transcribes",
            body: "When the video file can be fetched, it plays on the page while the transcript is being made.",
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
          "Private accounts and region-restricted videos can't be transcribed.",
          "Videos longer than 45 minutes aren't supported yet.",
          "The video is fetched from a free third-party source first. When that source is unavailable, the transcript may take longer or fail.",
          "Accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "Transcribe public Instagram Reels and video posts." },
          { href: "/tools/anonymous-tiktok-viewer", label: "Anonymous TikTok viewer", body: "Browse a public TikTok profile's videos and comments." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
