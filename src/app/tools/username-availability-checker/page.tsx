import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { UsernameAvailabilityWidget } from "@/components/tools/username-availability-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Username availability checker";
const DESCRIPTION =
  "Check whether a handle is taken across Instagram, TikTok, Facebook, and YouTube at once — one search, four platforms.";
const PATH = "/tools/username-availability-checker";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How does this check availability?",
    answer:
      "For each platform, we check that platform's own public profile page directly and look for a real, working signal — a page that loads for a taken handle, one that doesn't for an available one.",
  },
  {
    question: "Is this always accurate?",
    answer:
      "Not always. This checks each platform's public profile page directly and can occasionally be wrong or time out — treat it as a strong signal, not a guarantee. When a platform can't be checked reliably, it's shown honestly as \"Couldn't check\" rather than a guess.",
  },
  {
    question: "Why does Instagram or Facebook sometimes show \"Couldn't check\"?",
    answer:
      "Both platforms often redirect an unauthenticated request to their login page regardless of whether the handle is taken or available, which gives no usable signal — we show that honestly instead of guessing either way.",
  },
];

export default function UsernameAvailabilityCheckerPage() {
  return (
    <>
      <JsonLd
        id="ld-username-availability-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-username-availability-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Type a handle and check whether it's taken on Instagram, TikTok, Facebook, and YouTube — all four platforms at once."
        widget={<UsernameAvailabilityWidget />}
        howItWorks={[
          "Type a handle, without the @.",
          "We check that handle against all four platforms at once.",
          "Each platform shows Available, Taken, or Couldn't check — never a guess.",
        ]}
        features={[
          { title: "Four platforms at once", body: "Instagram, TikTok, Facebook, and YouTube, in a single search." },
          { title: "Real checks, not a database", body: "Each result comes from checking that platform's own profile page directly." },
          { title: "Honest about failure", body: "When a platform can't be checked reliably, it says so instead of guessing." },
        ]}
        limitations={[
          "Instagram and Facebook frequently can't be checked reliably from an automated request and show \"Couldn't check.\"",
          "A handle valid on one platform's rules might not be valid on another's — each platform enforces its own format.",
        ]}
        relatedTools={[
          { href: "/tools/hashtag-generator", label: "Hashtag generator", body: "Get hashtag suggestions for a caption or topic." },
          { href: "/tools/instagram-engagement-calculator", label: "Engagement calculator", body: "Calculate engagement rate for a public profile." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
