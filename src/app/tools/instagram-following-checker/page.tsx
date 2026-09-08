import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram following checker";
const DESCRIPTION =
  "Search within a public Instagram profile's indexed following list — check who a profile follows without scrolling through the whole list by hand.";
const PATH = "/tools/instagram-following-checker";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Can I search who a profile follows?",
    answer:
      "Yes — once a profile has been opened and its following list indexed, the Following tab has a search box that filters by name or username in real time.",
  },
  {
    question: "Does this show everyone a profile follows, even for large accounts?",
    answer:
      "No. Each capture indexes up to 500 following identities per profile, and the tab always shows the real indexed count next to the true following count — see /data-methodology for exactly how coverage is measured.",
  },
  {
    question: "Does this work on private accounts?",
    answer: "No — only public profiles can be indexed, the same public-data-only rule as the rest of SocialTrace.",
  },
];

export default function InstagramFollowingCheckerPage() {
  return (
    <>
      <JsonLd
        id="ld-following-checker-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-following-checker-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search a public Instagram profile, open its Following tab, and search within the indexed list by name or username."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its profile.",
          "Open the Following tab.",
          "Type a name or username into the search box to filter the indexed list in real time.",
        ]}
        features={[
          { title: "Real-time search", body: "Filters the indexed following list as you type — no page reload." },
          { title: "Verified badges shown", body: "Verified accounts in the list are marked, same as on Instagram." },
          { title: "Honest coverage", body: "The tab always shows how many of the true following count were actually indexed." },
        ]}
        limitations={[
          "Each capture indexes up to 500 following identities — accounts followed heavily will show partial coverage.",
          "Only public profiles can be indexed.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-follower-checker", label: "Follower checker", body: "Search within a profile's indexed follower list." },
          { href: "/tools/instagram-follower-history", label: "Follower history", body: "Track a profile's follower count over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
