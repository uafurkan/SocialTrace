import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Instagram following checker";
const DESCRIPTION =
  "Check which public Instagram accounts a profile follows: search its indexed following list by name or username, and see how much of the list was captured.";
const PATH = "/tools/instagram-following-checker";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Can I check whether a profile follows a specific account?",
    answer:
      "Yes, if that account appears in the profile's indexed following list. Search the Following tab for its name or username. If it's missing, it may be outside the captured part of a large list, so check the coverage shown on the tab.",
  },
  {
    question: "Is the Following tab the accounts that follow the profile?",
    answer:
      "No. The Following tab shows the accounts this profile follows. For the accounts that follow a profile, use the Instagram follower checker.",
  },
  {
    question: "Does this work on private accounts?",
    answer: "No — only public profiles can be searched, the same public-data-only rule as the rest of SocialTrace.",
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
        path={PATH}
        title={TITLE}
        lead="Open a public Instagram profile's Following tab to see which accounts it follows, and search that list by name or username."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its profile.",
          "Open the Following tab, which lists the accounts this profile follows.",
          "Type a name or username in the search box to filter the captured list.",
        ]}
        features={[
          {
            title: "Accounts this profile follows",
            body: "Shows the accounts the profile itself follows, not the people who follow it.",
          },
          {
            title: "Search by name or username",
            body: "Filters the captured list as you type, with no page reload.",
          },
          {
            title: "Coverage on the tab",
            body: "The tab shows how many following accounts were captured, so you can tell a missing name from an incomplete list.",
          },
        ]}
        limitations={[
          "The Following tab holds up to 200 following accounts. Profiles that follow more than that show partial coverage.",
          "The list may be cached for up to two days, so a recent follow can take a while to appear.",
          "Only public profiles can be searched.",
        ]}
        relatedTools={[
          {
            href: "/tools/instagram-follower-checker",
            label: "Follower checker",
            body: "Search the accounts that follow a profile, by name or username.",
          },
          {
            href: "/tools/instagram-competitor-analyzer",
            label: "Competitor analyzer",
            body: "Compare public brand accounts side by side.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
