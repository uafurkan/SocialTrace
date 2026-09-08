import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { HashtagGeneratorWidget } from "@/components/tools/hashtag-generator-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Hashtag generator";
const DESCRIPTION =
  "Paste a caption or describe your post and get matching hashtag suggestions — from a hand-curated list, not fabricated popularity numbers.";
const PATH = "/tools/hashtag-generator";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Where do these hashtags come from?",
    answer:
      "A hand-curated, hand-maintained list organized by topic (fitness, food, travel, and more). Your text is matched against topic keywords to pick the best-fitting category.",
  },
  {
    question: "Do you show how popular each hashtag is?",
    answer:
      "No — this tool never shows fabricated popularity, volume, or reach numbers. It returns hashtag suggestions only, nothing that looks like invented analytics.",
  },
  {
    question: "What if my topic doesn't match a category?",
    answer:
      "You'll get a small set of clearly generic tags instead, labeled as such — never a false claim of a targeted match.",
  },
];

export default function HashtagGeneratorPage() {
  return (
    <>
      <JsonLd
        id="ld-hashtag-generator-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-hashtag-generator-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste a caption or describe your video or post, and get a set of matching hashtags — copyable in one click."
        widget={<HashtagGeneratorWidget />}
        howItWorks={[
          "Paste a caption, or describe your video or post in a sentence.",
          "We match your text against hand-curated topic categories.",
          "Get up to 20 relevant hashtags, ready to copy.",
        ]}
        features={[
          { title: "Hand-curated, not scraped", body: "Every hashtag list is written and reviewed, not pulled from an API." },
          { title: "No fabricated numbers", body: "No popularity, volume, or reach figures — hashtags only." },
          { title: "Honest fallback", body: "No topic match shows clearly generic tags, never a false targeted claim." },
        ]}
        limitations={[
          "Covers a fixed set of topic categories — very niche topics may fall back to generic tags.",
          "No live trending data — the dataset is static and manually maintained.",
        ]}
        relatedTools={[
          { href: "/transcribe", label: "Video transcriber", body: "Turn a video into text, then paste it here for hashtags." },
          { href: "/tools/username-availability-checker", label: "Username availability checker", body: "Check a handle across four platforms at once." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
