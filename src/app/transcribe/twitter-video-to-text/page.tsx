import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "X (Twitter) video to text";
const DESCRIPTION =
  "Paste a public X or Twitter post link with a video and get a text transcript of its audio. Works with both x.com and twitter.com links.";
const PATH = "/transcribe/twitter-video-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public post's link from x.com or twitter.com. The post must contain the video.",
  "Paste it into the transcriber.",
  "Copy the plain text, or the version with timestamps.",
];

const FAQ = [
  {
    question: "Does this work with both x.com and twitter.com links?",
    answer: "Yes. Either domain works the same way, since both point to the same platform.",
  },
  {
    question: "Do I need an X account to use this?",
    answer:
      "No. Paste the post's public link. The video itself is not stored here; you get the transcript.",
  },
  {
    question: "Does it work on quote posts or replies with video?",
    answer:
      "Use the link to the post that contains the video, and that post needs to be public. A link to a post without a video has nothing to transcribe.",
  },
];

export default function TwitterVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-x-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-x-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-x-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-x-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public X (Twitter) post link with a video and get back what's said in it, as text you can search and copy."
        widget={<TranscriberWidget platformHint="X (Twitter)" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          {
            title: "x.com and twitter.com",
            body: "Either domain works. You don't need to convert the link first.",
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
          "Protected (private) accounts and deleted posts can't be transcribed.",
          "Videos longer than 45 minutes aren't supported yet.",
          "Accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok." },
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
          { href: "/transcribe/facebook-video-to-text", label: "Facebook video to text", body: "The same transcriber for Facebook links." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
