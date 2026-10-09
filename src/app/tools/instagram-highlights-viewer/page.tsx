import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram highlights viewer";
const DESCRIPTION =
  "View a public Instagram account's story highlights anonymously, without signing in. Shown wherever the data provider supplies highlights.";
const PATH = "/tools/instagram-highlights-viewer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Can I view Instagram highlights without an account?",
    answer:
      "Yes, when the data provider supplies them for that public account. Highlights are viewed without signing in.",
  },
  {
    question: "Why does a profile's Highlights tab show a message instead of highlights?",
    answer:
      "The tab shows a message instead of an empty list when highlights can't be loaded, for example when the data provider doesn't support them for that profile.",
  },
  {
    question: "Can I see highlights from a private account?",
    answer: "No. Only public accounts are supported, the same rule as the rest of SocialTrace.",
  },
];

export default function InstagramHighlightsViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-highlights-viewer-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-highlights-viewer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        path={PATH}
        title={TITLE}
        lead="View a public Instagram profile's story highlights anonymously, without signing in. Highlights appear wherever the data provider supplies them."
        primaryCta={{ href: "/", label: "Look up a profile" }}
        howItWorks={[
          "Search a public @username on the homepage.",
          "Open the Highlights tab. Each highlight shows its cover and title.",
          "Click a highlight to open its items, then use the arrows to move between them.",
        ]}
        features={[
          {
            title: "Cover and title",
            body: "Every highlight shows its cover image and name, as on the profile.",
          },
          {
            title: "Step through items",
            body: "Open a highlight and move through its photos and videos one at a time.",
          },
          {
            title: "Clear availability",
            body: "When highlights can't be loaded for a profile, the tab says so instead of showing an empty list.",
          },
        ]}
        limitations={[
          "Highlights depend on the data provider. When it doesn't supply them, the tab says so.",
          "Results can be cached for a few hours, so a newly added highlight may take a while to appear.",
          "Only public accounts are shown.",
        ]}
        relatedTools={[
          {
            href: "/tools/instagram-story-viewer",
            label: "Story viewer",
            body: "View a public profile's currently active stories anonymously.",
          },
          {
            href: "/tools/anonymous-instagram-viewer",
            label: "Anonymous Instagram viewer",
            body: "Browse posts, reels, stories, highlights and tagged posts.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
