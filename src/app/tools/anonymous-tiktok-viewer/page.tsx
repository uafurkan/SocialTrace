import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Anonymous TikTok viewer";
const DESCRIPTION =
  "Browse a public TikTok profile's videos, comments, and follower/following lists without an account, without logging in, and without the profile knowing.";
const PATH = "/tools/anonymous-tiktok-viewer";

const FAQ = [
  {
    question: "Do I need a TikTok account to use this?",
    answer: "No. Nothing here ever asks for a TikTok login. Search a public @username and its available data loads directly.",
  },
  {
    question: "Is it really anonymous?",
    answer:
      "Yes. There's no account required on our side either — searching and viewing don't add you to that profile's followers, viewers, or any other list TikTok itself tracks.",
  },
  {
    question: "What can I actually view?",
    answer:
      "Whatever the profile has made public: its videos with like/comment/view counts, comments on each video, and follower/following lists up to what's indexed. Private accounts stay private.",
  },
  {
    question: "Can I download videos?",
    answer: "Yes — each video has a download action for the real video file.",
  },
  {
    question: "Does it work on a private account?",
    answer:
      "No. A private account's content is only visible to its approved followers on TikTok itself, and that's respected here — you'll see an honest 'not available' state instead of anything fabricated.",
  },
];

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function AnonymousTikTokViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-anon-tiktok-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-anon-tiktok-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search any public TikTok @username to browse its videos, comments, and followers/following — no account, no login, and the profile is never notified."
        primaryCta={{ href: "/", label: "Search a TikTok profile" }}
        howItWorks={[
          "Search a public TikTok @username or paste a profile link on the homepage's TikTok tab.",
          "Browse the video grid — like, comment, and view counts are shown for each one.",
          "Click a video to read its comments, or download the video file directly.",
        ]}
        features={[
          { title: "No account, no login", body: "Nothing to sign up for on either side — search and view immediately." },
          { title: "Real videos and comments", body: "Every video and comment shown is live data, not fabricated." },
          { title: "Coverage shown honestly", body: "Follower/following lists show exactly what fraction was indexed — never a raw count passed off as the full list." },
          { title: "Download originals", body: "Save the real video file for any public post." },
        ]}
        limitations={[
          "Private accounts are never accessible — this respects TikTok's own privacy setting rather than working around it.",
          "Follower/following lists are capped per lookup; large accounts show partial coverage, labeled as such.",
          "Per-video likers lists aren't available — TikTok doesn't expose a scrapable list of who liked a video, only aggregate counts.",
        ]}
        relatedTools={[
          { href: "/tools/anonymous-instagram-viewer", label: "Anonymous Instagram viewer", body: "The same anonymous browsing experience, for Instagram." },
          { href: "/tools/anonymous-facebook-viewer", label: "Anonymous Facebook viewer", body: "Browse a public Facebook Page's posts without an account." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
