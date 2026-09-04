import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";

const TITLE = "Instagram growth tracker";
const DESCRIPTION =
  "Track a set of public Instagram profiles on one dashboard and see each profile's follower delta since its previous snapshot.";
const PATH = "/tools/instagram-growth-tracker";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const FAQ = [
  {
    question: "Do I need to sign in?",
    answer:
      "No. The dashboard identifies your browser through an anonymous first-party cookie. There is no account, no email, and no cross-device sync — clearing cookies clears your tracked list.",
  },
  {
    question: "How often are numbers updated?",
    answer:
      "Only when someone captures a new snapshot for that profile. There is no scheduler in this build; the dashboard shows the delta between the two most recent snapshots for each tracked profile.",
  },
  {
    question: "Can I save searches over a tracked profile?",
    answer:
      "Yes — on the Followers or Following page use Save search, and the /tracking dashboard shows new and removed matching accounts between the two most recent snapshots.",
  },
];

export default function InstagramGrowthTrackerPage() {
  return (
    <>
      <JsonLd
        id="ld-growth-tracker-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-growth-tracker-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Track any set of public profiles on one dashboard. Each row shows the follower delta since that profile's previous snapshot — real change, not estimation."
        primaryCta={{ href: "/tracking", label: "Open the dashboard" }}
        howItWorks={[
          "Search a public @username and open its profile.",
          "Click Track profile — the profile joins the /tracking dashboard for this browser.",
          "Return to /tracking any time to see the current delta per tracked profile.",
        ]}
        features={[
          { title: "One click to track", body: "Track and untrack from the profile header — no forms, no configuration." },
          { title: "Per-profile delta", body: "Each row shows the follower change since the last snapshot of that profile." },
          { title: "Saved searches inline", body: "Saved substring queries against a profile's followers or following appear on the same dashboard." },
          { title: "Anonymous by design", body: "No sign-in — a first-party browser cookie identifies you." },
        ]}
        limitations={[
          "No scheduler yet: deltas only refresh when someone captures a new snapshot manually.",
          "Cookie identity means clearing site data clears your tracked list.",
          "No notification channel — the dashboard is pull, not push.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-follower-history", label: "Instagram follower history", body: "See the full time series behind the delta on the dashboard." },
          { href: "/tools/instagram-follower-compare", label: "Instagram follower compare", body: "Pick any two snapshots to see the accounts behind the delta." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
