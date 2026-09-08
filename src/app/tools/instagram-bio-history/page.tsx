import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { ProfileFieldHistoryWidget } from "@/components/tools/profile-field-history-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram bio history";
const DESCRIPTION =
  "See a public Instagram profile's recorded bio changes — every edit detected between captured snapshots, with old and new text side by side.";
const PATH = "/tools/instagram-bio-history";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Where does bio history come from?",
    answer:
      "Every time a snapshot is captured for a profile, its bio is compared against the previous snapshot. A change is only recorded when the text actually differs — nothing is guessed or backfilled.",
  },
  {
    question: "How far back does it go?",
    answer:
      "History only covers bio changes recorded since SocialTrace started tracking this profile. A change that happened before the first snapshot won't show up.",
  },
  {
    question: "Does this work on private accounts?",
    answer: "No — only public profiles can be tracked, the same public-data-only rule as the rest of SocialTrace.",
  },
];

export default function InstagramBioHistoryPage() {
  return (
    <>
      <JsonLd
        id="ld-bio-history-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-bio-history-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search a public Instagram profile and see every bio change recorded between its captured snapshots — old text, new text, and when it changed."
        widget={<ProfileFieldHistoryWidget field="bio" />}
        howItWorks={[
          "Enter a public @username or profile link.",
          "We look up recorded changes for that profile's bio field, filtered from its full Changes tab.",
          "Each entry shows the old bio, the new bio, and when the change was detected.",
        ]}
        features={[
          { title: "Real detected changes", body: "Every entry comes from comparing two real captured snapshots." },
          { title: "Old vs. new, side by side", body: "See exactly what the bio said before and after each change." },
          { title: "No fabrication", body: "A profile with no recorded changes shows an honest empty state, not filler." },
        ]}
        limitations={[
          "History only starts from a profile's first captured snapshot — earlier changes aren't recorded.",
          "Snapshots don't run on a schedule in this build, so history depends on how often a profile was captured.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-username-history", label: "Username history", body: "See recorded username changes for a profile." },
          { href: "/tools/instagram-follower-history", label: "Follower history", body: "Track a profile's follower count over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
