import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Video downloader";
const DESCRIPTION =
  "Download a public TikTok, Instagram, or Facebook video after transcribing it — free, with a visible link back to the original source.";
const PATH = "/tools/video-downloader";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do I download a video?",
    answer:
      "Paste the video's link into the video transcriber. Once it finishes, a Download video button appears next to the video preview.",
  },
  {
    question: "Is the original source shown?",
    answer:
      "Yes — every download is shown alongside a visible link back to the original URL you submitted. This is never hidden or optional.",
  },
  {
    question: "Why isn't YouTube supported?",
    answer:
      "YouTube has no free official download path — the only way in is a bypass technique that carries real terms-of-service risk. This feature covers TikTok, Instagram, and Facebook, where free, reliable paths already exist. YouTube transcription itself is unaffected.",
  },
  {
    question: "Can I download private videos?",
    answer: "No — only public content can be fetched at all, the same rule as every other feature on this site.",
  },
];

export default function VideoDownloaderPage() {
  return (
    <>
      <JsonLd
        id="ld-video-downloader-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-video-downloader-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public TikTok, Instagram, or Facebook video link into the transcriber, and download the video once it's ready — with a visible link back to its source."
        primaryCta={{ href: "/transcribe", label: "Open the video transcriber" }}
        howItWorks={[
          "Paste a public TikTok, Instagram, or Facebook video link into the transcriber.",
          "Once the video loads, a Download video button appears next to the preview.",
          "The original source link is always shown next to the download.",
        ]}
        features={[
          { title: "Three platforms", body: "TikTok, Instagram, and Facebook — YouTube is intentionally excluded." },
          { title: "Source always shown", body: "A visible link back to the original URL accompanies every download." },
          { title: "Public content only", body: "The same public-data-only rule as every other feature on this site." },
        ]}
        limitations={[
          "YouTube is not supported for downloading (transcription still works via YouTube's own captions).",
          "Only public videos can be fetched — private or restricted content is never accessible.",
        ]}
        relatedTools={[
          { href: "/transcribe", label: "Video transcriber", body: "Turn a video into text across four platforms." },
          { href: "/tools/hashtag-generator", label: "Hashtag generator", body: "Get hashtag suggestions for a caption or topic." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
