import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram follower compare";
const DESCRIPTION =
  "Pick any two snapshots of a public Instagram profile and see exactly which accounts followed and which unfollowed between them.";
const PATH = "/tools/instagram-follower-compare";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Do I have to compare the two most recent snapshots?",
    answer:
      "No — the Compare snapshots page lets you pick any two snapshots the profile has, adjacent or not. The comparison is reconstructed on demand from each identity's membership history.",
  },
  {
    question: "What happens if a snapshot's coverage is low?",
    answer:
      "If either side is below 99.5% coverage, the comparison is withheld and the page says so. Below that threshold missing accounts cannot be told apart from real unfollows, so a fabricated list would be dishonest.",
  },
  {
    question: "Does this also work for the following list?",
    answer:
      "Yes — the Compare view toggles between followers and following, and applies the same coverage rule to both.",
  },
];

export default function InstagramFollowerComparePage() {
  return (
    <>
      <JsonLd
        id="ld-follower-compare-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-follower-compare-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Two snapshots you captured, side by side. Who followed, who unfollowed, and how the total moved — reconstructed on demand from the membership history, not stored separately."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username and open its profile.",
          "Capture at least two snapshots via the History tab.",
          "Click Compare snapshots on the profile header and pick the two snapshots to compare.",
        ]}
        features={[
          { title: "Any pair of snapshots", body: "Not restricted to the most recent two — you can walk arbitrarily far back." },
          { title: "New and removed lists", body: "Each side shows the accounts behind the number, not just a count." },
          { title: "Coverage-gated", body: "Comparisons are withheld below 99.5% coverage on either side rather than fabricated." },
          { title: "Followers and following", body: "The same view compares either dataset with the same rules." },
        ]}
        limitations={[
          "You need at least two snapshots of the same profile before Compare is meaningful.",
          "Below 99.5% coverage on either side, the comparison is withheld with an explanation.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-follower-history", label: "Instagram follower history", body: "The counts over time that make each Compare pair possible." },
          { href: "/tools/instagram-growth-tracker", label: "Instagram growth tracker", body: "Watch a set of profiles and their per-snapshot deltas from a dashboard." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
