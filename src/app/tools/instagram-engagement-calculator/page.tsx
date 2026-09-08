import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { EngagementCalculatorWidget } from "@/components/tools/engagement-calculator-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Engagement rate calculator";
const DESCRIPTION = "Paste a public Instagram, TikTok, or Facebook profile and get its engagement rate — average likes and comments per post, divided by follower count.";
const PATH = "/tools/instagram-engagement-calculator";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How is engagement rate calculated?",
    answer:
      "We fetch the most recent 12 public posts, average their likes and comments, add those two averages together, and divide by the profile's follower count. The result is shown as a percentage, along with the exact sample size used.",
  },
  {
    question: "Does this work on private accounts?",
    answer: "No — only public profiles can be sampled, the same public-data-only rule as the rest of SocialTrace.",
  },
  {
    question: "Why does my number differ from another tool?",
    answer:
      "Different tools use different sample sizes and definitions of \"engagement\" (some include shares or saves, some use a different post count). Ours is transparent about exactly what it samples — there's no single industry-standard formula.",
  },
];

export default function EngagementCalculatorPage() {
  return (
    <>
      <JsonLd
        id="ld-engagement-calculator-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-engagement-calculator-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public profile from Instagram, TikTok, or Facebook and get its engagement rate — worked out from real recent posts, not an estimate."
        widget={<EngagementCalculatorWidget />}
        howItWorks={[
          "Pick a platform and paste a public username or profile link.",
          "We fetch the most recent 12 public posts and sum their likes and comments.",
          "Engagement rate is that average, divided by the profile's follower count.",
        ]}
        features={[
          { title: "Real recent posts", body: "Calculated from the profile's actual most recent public posts, not a guess." },
          { title: "Transparent sample size", body: "Always shows exactly how many posts the number is based on." },
          { title: "Works across platforms", body: "Instagram, TikTok, and Facebook, using the same formula for each." },
          { title: "Free, no sign-up", body: "No account required for a limited number of checks per day." },
        ]}
        limitations={[
          "Only public profiles can be sampled — private accounts are not supported.",
          "Based on the most recent 12 posts, not the account's full history.",
          "A brand-new account with very few posts will show a smaller, less representative sample.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-competitor-analyzer", label: "Competitor analyzer", body: "Compare two profiles' engagement side by side." },
          { href: "/tools/instagram-follower-history", label: "Follower history", body: "Track a profile's follower count over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
