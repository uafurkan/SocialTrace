import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram followers export";
const DESCRIPTION =
  "Export a public Instagram profile's followers, following, posts or reels to CSV, or the full profile to JSON or XML. No account needed.";
const PATH = "/tools/instagram-followers-export";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Can I export an Instagram follower list to CSV?",
    answer:
      "Yes. Open a public profile, click Export, and choose Followers — CSV. The file has one row per follower captured, up to 200.",
  },
  {
    question: "Is there a limit on how many followers I can export?",
    answer:
      "Yes. Each export holds up to 500 posts or reels, and up to 200 followers or following accounts. Accounts with more followers get a partial export, and the profile shows how much of the real list was captured.",
  },
  {
    question: "Do I need an account to export?",
    answer:
      "No. Exports work without signing in, under the same public-data-only rule as the rest of SocialTrace. Private accounts cannot be exported.",
  },
];

export default function InstagramFollowersExportPage() {
  return (
    <>
      <JsonLd
        id="ld-followers-export-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-followers-export-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        path={PATH}
        title={TITLE}
        lead="Export a public Instagram profile's followers, following, posts or reels as CSV, or the full profile as JSON or XML. Posts and reels hold up to 500 items each; followers and following hold up to 200 accounts each."
        primaryCta={{ href: "/", label: "Look up a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its profile.",
          "Click Export and pick a format: Followers, Following, Posts or Reels as CSV, or the full profile as JSON or XML.",
          "Your browser downloads the file. No account or sign-in is needed.",
        ]}
        features={[
          {
            title: "One CSV per list",
            body: "Followers, following, posts and reels each export as a separate CSV file, one row per item.",
          },
          {
            title: "Full profile in JSON or XML",
            body: "A single file with the profile details plus posts, reels, followers and following, for use in other tools.",
          },
          {
            title: "Coverage stated",
            body: "The profile shows how much of the real list was captured, so you know whether an export is complete.",
          },
        ]}
        limitations={[
          "Posts and reels export up to 500 items each. Followers and following export up to 200 accounts each, so accounts with more get a partial export.",
          "Only public profiles can be exported.",
          "Each visitor can run a limited number of exports every few minutes.",
          "Exports are generated when you click them and are not stored, so export again to get fresh data.",
        ]}
        relatedTools={[
          {
            href: "/tools/instagram-follower-checker",
            label: "Follower checker",
            body: "Search within a profile's indexed follower list by name or username.",
          },
          {
            href: "/tools/instagram-engagement-calculator",
            label: "Engagement calculator",
            body: "Work out a profile's engagement rate from its public numbers.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
