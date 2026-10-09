import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "YouTube transcript generator";
const DESCRIPTION =
  "Paste a public YouTube video, youtu.be, or Shorts link and get a text transcript. Uses the video's captions when YouTube provides them, and speech-to-text otherwise.";
const PATH = "/transcribe/youtube-transcript-generator";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public YouTube watch, youtu.be, or Shorts link.",
  "Paste it into the transcriber. Leave the language on auto-detect, or choose one.",
  "Copy the plain text, or the version with timestamps.",
];

const FAQ = [
  {
    question: "Does this use YouTube's own captions?",
    answer:
      "Sometimes. When YouTube provides a video's captions, the transcript can come from them, which is quick and free. When it doesn't, the audio is transcribed with speech-to-text.",
  },
  {
    question: "Does it work on videos without captions?",
    answer:
      "Yes. The audio is transcribed with speech-to-text. The spoken language is detected automatically unless you choose one from the list in the tool.",
  },
  {
    question: "Do YouTube Shorts work?",
    answer: "Yes. Links in the youtube.com/shorts/ form are read the same way as regular watch links.",
  },
];

export default function YoutubeTranscriptGeneratorPage() {
  return (
    <>
      <JsonLd id="ld-yt-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-yt-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-yt-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-yt-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public YouTube video, youtu.be, or Shorts link. The transcript comes from the video's captions when YouTube provides them, and from speech-to-text otherwise."
        widget={<TranscriberWidget platformHint="YouTube" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          {
            title: "Three link forms",
            body: "Watch links, youtu.be short links, and Shorts links are all read, so you can paste whichever one you copied.",
          },
          {
            title: "Captions when YouTube provides them",
            body: "For videos whose captions are available to the tool, the transcript comes from them. Otherwise the audio is transcribed.",
          },
          {
            title: "Plain text or timestamps",
            body: "Copy the transcript as plain text, or with timestamps for finding a passage in a long video.",
          },
          {
            title: "Translate the result",
            body: "Translate the transcript into another language from the same tool.",
          },
        ]}
        limitations={[
          "Private videos, and videos restricted by region or age, can't be transcribed.",
          "Videos longer than 45 minutes aren't supported yet.",
          "Accuracy drops with heavy background noise, overlapping speakers, or strong accents.",
        ]}
        relatedTools={[
          { href: "/transcribe/tiktok-video-to-text", label: "TikTok video to text", body: "The same transcriber for TikTok links." },
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "Transcribe public Instagram Reels and video posts." },
          { href: "/transcribe/twitter-video-to-text", label: "X (Twitter) video to text", body: "The same transcriber for X and Twitter links." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
