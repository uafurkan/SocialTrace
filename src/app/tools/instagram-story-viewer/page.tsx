import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Anonymous Instagram story viewer";
const DESCRIPTION =
  "View a public Instagram account's currently active stories without an account, without logging in, and without appearing in their viewer list.";
const PATH = "/tools/instagram-story-viewer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Do I need an Instagram account to view stories?",
    answer:
      "No. Search a public @username on the homepage, open its Stories tab, and any currently active story loads directly — no sign-in, no app install.",
  },
  {
    question: "Will the account know I viewed their story?",
    answer:
      "No. Stories are fetched independently of any Instagram account, so nothing is added to that account's own viewer list.",
  },
  {
    question: "Can I view stories from a private account?",
    answer:
      "No. Only stories a public account has made publicly visible are shown — the same real audience Instagram's own app would show for a public profile. There is no way to see a private account's stories, and this build doesn't pretend otherwise.",
  },
  {
    question: "Can I see stories from earlier today or yesterday?",
    answer:
      "Only what's active right now. Stories expire after 24 hours on Instagram itself, and this tool doesn't keep an archive of ones that already expired.",
  },
  {
    question: "Can I download the story?",
    answer:
      "Yes — each story has a download action that saves the actual photo or video file, not just a screenshot.",
  },
];

export default function InstagramStoryViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-story-viewer-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-story-viewer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search any public @username and open its Stories tab to see what's currently active — no account, no login, and the account you're viewing is never notified."
        primaryCta={{ href: "/", label: "Search a profile" }}
        howItWorks={[
          "Search a public @username on the homepage.",
          "Open the profile's Stories tab.",
          "Any currently active story loads directly, with a download option for the photo or video.",
        ]}
        features={[
          { title: "No account required", body: "Nothing to sign up for and nothing to install — search a username and view." },
          { title: "Genuinely anonymous", body: "Viewing here never adds you to the account's own story viewer list." },
          { title: "Real, not cached screenshots", body: "Stories are fetched live — what's active right now, not an old copy." },
          { title: "Download the original file", body: "Save the actual photo or video, not a lower-quality screen recording." },
        ]}
        limitations={[
          "Only public accounts' currently active stories — private accounts are never accessible, and there's no way around that.",
          "No archive of past stories. Once a story expires on Instagram (24 hours), it's gone here too.",
          "Highlights (a profile's saved story collections) are a separate tab — see the profile's Highlights tab for those.",
        ]}
        relatedTools={[
          { href: "/tools/anonymous-instagram-viewer", label: "Anonymous Instagram viewer", body: "Browse a public profile's posts, reels, and highlights anonymously too." },
          { href: "/tools/instagram-follower-history", label: "Instagram follower history", body: "Capture snapshots and see a profile's follower count change over time." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
