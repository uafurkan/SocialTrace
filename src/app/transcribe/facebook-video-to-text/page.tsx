import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Facebook video to text";
const DESCRIPTION =
  "Paste a public Facebook video, Watch, or Reel link and get a text transcript of its audio. Works with facebook.com and fb.watch links.";
const PATH = "/transcribe/facebook-video-to-text";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const HOW_IT_WORKS = [
  "Copy a public video link from facebook.com or fb.watch, including Watch, Reel, and share links.",
  "Paste it into the transcriber.",
  "Copy the plain text, or the version with timestamps.",
];

const FAQ = [
  {
    question: "Does this work on Watch videos and Reels?",
    answer:
      "Yes. Watch, video, and Reel links from facebook.com and fb.watch work when the video is public.",
  },
  {
    question: "Can I transcribe a video from a private group or profile?",
    answer: "No. Only public videos can be transcribed.",
  },
  {
    question: "Is the video shown too?",
    answer:
      "While the transcript is being made, the video plays on the page when its file can be fetched.",
  },
];

export default function FacebookVideoToTextPage() {
  return (
    <>
      <JsonLd id="ld-fb-transcript-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: "/transcribe" }, { name: TITLE, path: PATH }])} />
      <JsonLd id="ld-fb-transcript-faq" data={faqJsonLd(FAQ)} />
      <JsonLd id="ld-fb-transcript-howto" data={howToJsonLd({ name: TITLE, steps: HOW_IT_WORKS })} />
      <JsonLd id="ld-fb-transcript-app" data={softwareApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public Facebook video, Watch, or Reel link and get a text transcript of its audio."
        widget={<TranscriberWidget platformHint="Facebook" autoSubmitFromQueryParam />}
        howItWorks={HOW_IT_WORKS}
        features={[
          {
            title: "Several link shapes",
            body: "Watch links, /videos/ links, Reel links, and share links are all read, as long as the video is public.",
          },
          {
            title: "Video preview while it transcribes",
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
          "Private groups, private profiles, and region-restricted videos can't be transcribed.",
          "Videos longer than 45 minutes aren't supported yet.",
          "Facebook sometimes changes how its video links are served, which can make a link fail for a while.",
          "Accuracy drops with loud background music or overlapping voices.",
        ]}
        relatedTools={[
          { href: "/transcribe/youtube-transcript-generator", label: "YouTube transcript generator", body: "Transcribe YouTube videos and Shorts." },
          { href: "/transcribe/instagram-reel-to-text", label: "Instagram Reel to text", body: "Transcribe public Instagram Reels and video posts." },
          { href: "/tools/anonymous-facebook-viewer", label: "Anonymous Facebook viewer", body: "Browse a public Facebook Page's posts and comments." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
