import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram reels viewer";
const DESCRIPTION =
  "Browse a public Instagram account's latest reels anonymously, and export its reels list to CSV. No login needed.";
const PATH = "/tools/instagram-reels-viewer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do I see a public Instagram account's reels without logging in?",
    answer:
      "Search the account's @username, open its Reels tab, and browse the grid. No sign-in is needed.",
  },
  {
    question: "How many reels does the Reels tab show?",
    answer:
      "The latest 24 reels for the profile. The CSV export can include up to 500 reels.",
  },
  {
    question: "Can I download a reel from this page?",
    answer:
      "No. The Reels tab shows the reels and their likers and comments. For a public video download, use the Video downloader.",
  },
];

export default function InstagramReelsViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-reels-viewer-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-reels-viewer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Browse a public Instagram profile's reels anonymously, then export the reels list to CSV. No sign-in needed."
        primaryCta={{ href: "/", label: "Look up a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its Reels tab.",
          "Browse the latest reels in the grid.",
          "To save the list, click Export and choose Reels — CSV.",
        ]}
        features={[
          {
            title: "Latest reels",
            body: "The Reels tab loads the profile's most recent 24 reels.",
          },
          {
            title: "Likers and comments per reel",
            body: "Click a reel to see who liked it and what was commented.",
          },
          {
            title: "Reels CSV export",
            body: "Export the reels list to a CSV file from the profile's Export menu.",
          },
        ]}
        limitations={[
          "The Reels tab shows the latest 24 reels. There is no page-by-page browsing in this version.",
          "Reels can be cached for a few hours, so very new reels may take a while to appear.",
          "Only public accounts are shown.",
        ]}
        relatedTools={[
          {
            href: "/tools/instagram-post-likers",
            label: "Who liked a post",
            body: "See the likers and comments on a public Instagram post.",
          },
          {
            href: "/tools/video-downloader",
            label: "Video downloader",
            body: "Download a public TikTok, Instagram or Facebook video, with a visible source link.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
