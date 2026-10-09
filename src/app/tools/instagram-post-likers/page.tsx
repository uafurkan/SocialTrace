import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Who liked an Instagram post";
const DESCRIPTION =
  "See the public accounts that liked, and the comments left on, a public Instagram post, without signing in. TikTok and Facebook posts show comments.";
const PATH = "/tools/instagram-post-likers";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Can I see who liked an Instagram post?",
    answer:
      "Yes, for public Instagram posts. Open the post from the profile's Posts tab and choose Likers. The list shows the accounts the data provider returned for that post.",
  },
  {
    question: "Can I see comments on TikTok or Facebook posts?",
    answer:
      "Yes. Comments are available for public TikTok and Facebook posts. A list of likers is only available for Instagram.",
  },
  {
    question: "Do I need an account?",
    answer: "No. Posts, likers and comments are viewed without signing in, under the same public-data-only rule as the rest of SocialTrace.",
  },
];

export default function InstagramPostLikersPage() {
  return (
    <>
      <JsonLd
        id="ld-post-likers-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-post-likers-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Open a public Instagram post to see the accounts that liked it and the comments underneath, without signing in."
        primaryCta={{ href: "/", label: "Look up a profile" }}
        howItWorks={[
          "Search a public @username on the homepage and open its Posts tab.",
          "Click the post you want to check.",
          "Switch between Likers and Comments. Instagram posts show both; TikTok and Facebook posts show comments.",
        ]}
        features={[
          {
            title: "Likers list",
            body: "Shows the accounts that liked the post, with a verified badge where the account is verified.",
          },
          {
            title: "Comments list",
            body: "Shows the comments on the post, with the count shown on the tab.",
          },
          {
            title: "Opened from the post grid",
            body: "Any post in the Posts tab opens its engagement view, so you don't leave the profile to check it.",
          },
        ]}
        limitations={[
          "Likers are available for Instagram posts only. TikTok and Facebook show comments.",
          "The lists come from the data provider and can be partial for posts with very high engagement.",
          "Only public posts and public profiles are shown.",
        ]}
        relatedTools={[
          {
            href: "/tools/instagram-engagement-calculator",
            label: "Engagement calculator",
            body: "Work out engagement rate from a profile's public numbers.",
          },
          {
            href: "/tools/anonymous-instagram-viewer",
            label: "Anonymous Instagram viewer",
            body: "Browse a public profile's posts, reels, stories and highlights.",
          },
        ]}
        faq={FAQ}
      />
    </>
  );
}
