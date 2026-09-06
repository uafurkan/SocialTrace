import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Anonymous Instagram viewer";
const DESCRIPTION =
  "Browse a public Instagram profile's posts, reels, stories, highlights, and tagged posts without an account, without logging in, and without the profile knowing.";
const PATH = "/tools/anonymous-instagram-viewer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Do I need to log in to Instagram to use this?",
    answer:
      "No. Nothing here ever asks for an Instagram login or password. Search a public @username and its available data loads directly.",
  },
  {
    question: "Is it really anonymous?",
    answer:
      "Yes. There's no account required on our side either — searching, viewing, and downloading don't add you to that profile's followers, viewers, or any other list Instagram itself tracks.",
  },
  {
    question: "What can I actually view?",
    answer:
      "Whatever the profile has made public: posts, reels, currently active stories, saved highlight reels and their contents, posts the profile is tagged in, and — per post — who liked it and what people commented, plus follower/following lists up to what's indexed. Private accounts stay private; there's no way around that, and this build doesn't pretend otherwise.",
  },
  {
    question: "Can I download photos and videos?",
    answer:
      "Yes — posts, reels, and stories each have a download action for the real media file, not a screenshot or re-encoded copy.",
  },
  {
    question: "Does it work on a private account?",
    answer:
      "No. A private account's content is only visible to its approved followers on Instagram itself, and that's respected here — you'll see an honest 'not available' state instead of anything fabricated.",
  },
];

export default function AnonymousInstagramViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-anon-viewer-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-anon-viewer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search any public @username to browse its posts, reels, stories, highlights, and tagged posts — no account, no login, and the profile is never notified."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username or paste a profile link on the homepage.",
          "Open the profile's tabs — Posts, Reels, Stories, Highlights, Tagged, Followers, Following.",
          "Click any post's like or comment count to see who liked it and what was said; download any photo or video directly.",
        ]}
        features={[
          { title: "No account, no login", body: "Nothing to sign up for on either side — search and view immediately." },
          { title: "Every tab is real data", body: "Posts, reels, stories, highlights, tagged posts, likers, and comments are all live, not fabricated." },
          { title: "Coverage shown honestly", body: "Follower/following lists show exactly what fraction was indexed — never a raw count passed off as the full list." },
          { title: "Download originals", body: "Save the real photo/video file for posts, reels, and stories." },
        ]}
        limitations={[
          "Private accounts are never accessible — this respects Instagram's own privacy setting rather than working around it.",
          "Follower/following lists are capped per lookup; large accounts show partial coverage, labeled as such.",
          "Stories only show what's currently active — there's no archive of ones that already expired.",
        ]}
        relatedTools={[
          { href: "/tools/instagram-story-viewer", label: "Instagram story viewer", body: "Jump straight to viewing a profile's currently active stories." },
          { href: "/tools/instagram-growth-tracker", label: "Instagram growth tracker", body: "Track a set of public profiles and see follower deltas over time." },
          { href: "/tools/anonymous-tiktok-viewer", label: "Anonymous TikTok viewer", body: "The same anonymous browsing experience, for TikTok." },
          { href: "/tools/anonymous-facebook-viewer", label: "Anonymous Facebook viewer", body: "Browse a public Facebook Page's posts without an account." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
