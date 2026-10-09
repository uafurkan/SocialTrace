import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "TikTok follower checker";
const DESCRIPTION =
  "Search a public TikTok account's followers and following lists by name or username, without signing in. Shows how much of each list was captured.";
const PATH = "/tools/tiktok-follower-checker";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do I check who follows a TikTok account?",
    answer:
      "Open the public TikTok profile, go to its Followers tab, and search the list. SocialTrace shows the followers the data provider returned, not a live feed.",
  },
  {
    question: "Is the TikTok follower list complete for large accounts?",
    answer:
      "Not always. Each list is limited to what the data provider returns, and the page shows the coverage so you can see how much was captured.",
  },
  {
    question: "Can I see who a TikTok account follows?",
    answer: "Yes. The Following tab works the same way and has its own search.",
  },
];

export default function TikTokFollowerCheckerPage() {
  return (
    <>
      <JsonLd
        id="ld-tiktok-follower-checker-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-tiktok-follower-checker-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        path={PATH}
        title={TITLE}
        lead="Open a public TikTok profile, then search its followers or following list by name or username, without signing in."
        primaryCta={{ href: "/", label: "Look up a profile" }}
        howItWorks={[
          "On the homepage, choose TikTok and enter a public @username.",
          "Open the Followers or Following tab.",
          "Type a name or username into the search box to filter the captured list.",
        ]}
        features={[
          {
            title: "Followers and following",
            body: "Both lists are available on a TikTok profile, each with its own search.",
          },
          {
            title: "Coverage shown",
            body: "Each list shows how many items were captured, so you know whether it is complete.",
          },
          {
            title: "No account needed",
            body: "Search and browse without signing in.",
          },
        ]}
        limitations={[
          "Each list is limited to what the data provider returns, so large accounts show partial coverage, which the page labels.",
          "CSV export is available for Instagram profiles only.",
          "Only public profiles are shown.",
        ]}
        relatedTools={[
          {
            href: "/tools/anonymous-tiktok-viewer",
            label: "Anonymous TikTok viewer",
            body: "Browse a public TikTok profile's videos and comments anonymously.",
          },
          {
            href: "/tools/instagram-follower-checker",
            label: "Instagram follower checker",
            body: "Search an Instagram profile's indexed follower list.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
