import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { CompetitorAnalyzerWidget } from "@/components/tools/competitor-analyzer-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Competitor analyzer";
const DESCRIPTION =
  "Compare two public profiles from Instagram, TikTok, or Facebook side by side — followers, posts sampled, and engagement rate for each.";
const PATH = "/tools/instagram-competitor-analyzer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How does this compare two profiles?",
    answer:
      "Each profile gets the same engagement rate calculation used by the Engagement calculator — most recent public posts, averaged, divided by follower count — run independently and shown side by side.",
  },
  {
    question: "What if one profile is private or has no posts?",
    answer:
      "The other profile's result still shows — a failure on one side never blocks the other. The failing side shows plainly why it couldn't be calculated.",
  },
  {
    question: "Can I compare two profiles on different platforms?",
    answer: "Yes — pick any platform independently for each profile.",
  },
];

export default function CompetitorAnalyzerPage() {
  return (
    <>
      <JsonLd
        id="ld-competitor-analyzer-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-competitor-analyzer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste two public profiles and see their engagement rate, followers, and post samples side by side — worked out from real recent posts, not an estimate."
        widget={<CompetitorAnalyzerWidget />}
        howItWorks={[
          "Pick a platform and paste a public username or profile link for each profile.",
          "We calculate engagement rate for both profiles independently, the same way the Engagement calculator does.",
          "Results appear side by side so you can compare at a glance.",
        ]}
        features={[
          { title: "Same formula, both sides", body: "Both profiles are measured with the identical engagement calculation." },
          { title: "Partial results", body: "If one profile fails (private, no posts), the other's result still shows." },
          { title: "Cross-platform", body: "Compare an Instagram profile against a TikTok or Facebook one." },
        ]}
        limitations={[
          "Only public profiles can be sampled — private accounts are not supported.",
          "Based on the most recent 12 posts per profile, not full account history.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-engagement-calculator", label: "Engagement calculator", body: "Calculate engagement rate for a single profile." },
          { href: "/tools/instagram-follower-history", label: "Follower history", body: "Track a profile's follower count over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
