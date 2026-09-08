import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { ProfileFieldHistoryWidget } from "@/components/tools/profile-field-history-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram username history";
const DESCRIPTION =
  "See a public Instagram profile's recorded username changes — every rename detected between captured snapshots, with old and new usernames side by side.";
const PATH = "/tools/instagram-username-history";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Where does username history come from?",
    answer:
      "Every profile is matched by its platform's own stable account id, not just its current username. When a capture sees the same account under a new username, that's recorded as a rename — nothing is guessed or backfilled.",
  },
  {
    question: "How far back does it go?",
    answer:
      "Tracking starts from the first time SocialTrace captured this profile's stable account id — a rename that happened earlier than that won't show up.",
  },
  {
    question: "Does this work on private accounts?",
    answer: "No — only public profiles can be tracked, the same public-data-only rule as the rest of SocialTrace.",
  },
];

export default function InstagramUsernameHistoryPage() {
  return (
    <>
      <JsonLd
        id="ld-username-history-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-username-history-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search a public Instagram profile and see every rename recorded between its captured snapshots — old username, new username, and when it changed."
        widget={<ProfileFieldHistoryWidget field="username" />}
        howItWorks={[
          "Enter a public @username or profile link.",
          "We look up recorded changes for that profile's username field, filtered from its full Changes tab.",
          "Each entry shows the old username, the new username, and when the rename was detected.",
        ]}
        features={[
          { title: "Real detected renames", body: "Matched by the platform's own stable account id, not just the current name." },
          { title: "Old vs. new, side by side", body: "See exactly what the account was called before and after each rename." },
          { title: "No fabrication", body: "A profile with no recorded renames shows an honest empty state, not filler." },
        ]}
        limitations={[
          "Tracking starts from the first time SocialTrace captured this profile's stable account id — earlier renames aren't recorded.",
          "Snapshots don't run on a schedule in this build, so history depends on how often a profile was captured.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-bio-history", label: "Bio history", body: "See recorded bio changes for a profile." },
          { href: "/tools/instagram-follower-history", label: "Follower history", body: "Track a profile's follower count over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
