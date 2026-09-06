import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram follower history";
const DESCRIPTION =
  "Capture repeated snapshots of a public Instagram profile and see how its follower count changed over time.";
const PATH = "/tools/instagram-follower-history";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Where does the history come from?",
    answer:
      "Each captured snapshot writes the profile's follower count at that moment to its History tab. History is exactly the list of snapshots that have been captured — nothing is backfilled or estimated.",
  },
  {
    question: "How far back does history go?",
    answer:
      "As far back as the first snapshot captured for that profile. If you just opened the profile, history starts now — capture more snapshots over time to build the series.",
  },
  {
    question: "Does it update automatically?",
    answer:
      "No. There is no scheduler in this build, so snapshots only run when someone captures one manually. See the changelog for what changes when a scheduler ships.",
  },
];

export default function InstagramFollowerHistoryPage() {
  return (
    <>
      <JsonLd
        id="ld-follower-history-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-follower-history-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Open a profile, capture a snapshot, and each snapshot's follower count joins the profile's History tab as a real data point — not an estimate."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its profile.",
          "Open the History tab and click Capture snapshot.",
          "Each capture records the profile's counts at that moment. Repeat over time to build the history series.",
        ]}
        features={[
          { title: "Real data points", body: "Every point on the history line is a real captured snapshot, timestamped." },
          { title: "Coverage per snapshot", body: "Each snapshot records what fraction of the real dataset it captured." },
          { title: "Cross-links to comparisons", body: "From any two snapshots you can jump straight to a full Compare view." },
          { title: "No fabrication", body: "History has no gaps filled in — if a period wasn't captured, it isn't drawn." },
        ]}
        limitations={[
          "Snapshots do not run on a schedule in this build. They only run when captured manually.",
          "Each snapshot is bounded at 500 followers and 500 following identities. Follower count itself is not bounded.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-follower-compare", label: "Instagram follower compare", body: "Pick two snapshots and see who joined or left between them." },
          { href: "/tools/instagram-growth-tracker", label: "Instagram growth tracker", body: "Track profiles on a dashboard with per-profile deltas." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
