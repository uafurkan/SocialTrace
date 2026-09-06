import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Anonymous Facebook viewer";
const DESCRIPTION =
  "Browse a public Facebook Page's posts and comments without an account, without logging in, and without the Page knowing.";
const PATH = "/tools/anonymous-facebook-viewer";

const FAQ = [
  {
    question: "Do I need a Facebook account to use this?",
    answer: "No. Nothing here ever asks for a Facebook login. Search a public Page name and its available data loads directly.",
  },
  {
    question: "Is it really anonymous?",
    answer:
      "Yes. There's no account required on our side either — searching and viewing don't add you to that Page's followers, viewers, or any other list Facebook itself tracks.",
  },
  {
    question: "What can I actually view?",
    answer:
      "Whatever the Page has made public: its posts (photos, videos, links) with like/comment/share counts, and comments on each post.",
  },
  {
    question: "Can I see a Page's followers or download its videos?",
    answer:
      "No. Facebook doesn't publicly expose a follower/following list the way Instagram and TikTok do — only a total count, which is shown honestly rather than faked as a browsable list. Video posts also have no direct downloadable file available through this build, only a link to view the post on Facebook.",
  },
  {
    question: "Does it work on personal profiles or private groups?",
    answer: "No — this works on public Facebook Pages only, the same public-data-only rule as the rest of SocialTrace.",
  },
];

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function AnonymousFacebookViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-anon-facebook-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: TITLE, path: PATH },
        ])}
      />
      <JsonLd id="ld-anon-facebook-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Search any public Facebook Page to browse its posts and comments — no account, no login, and the Page is never notified."
        primaryCta={{ href: "/", label: "Search a Facebook Page" }}
        howItWorks={[
          "Search a public Facebook Page name or paste its page link on the homepage's Facebook tab.",
          "Browse the post feed — like, comment, and share counts are shown for each one.",
          "Click a post to read its comments.",
        ]}
        features={[
          { title: "No account, no login", body: "Nothing to sign up for on either side — search and view immediately." },
          { title: "Real posts and comments", body: "Every post and comment shown is live data, not fabricated." },
          { title: "Honest about what's missing", body: "Follower count is real; the follower list itself isn't available anywhere on Facebook — shown as such, not faked." },
        ]}
        limitations={[
          "Facebook Pages only — personal profiles and private groups aren't supported.",
          "No follower/following list — Meta doesn't expose one publicly for any tool to fetch, only the total count.",
          "No direct video/photo download — only a link to view the original post on Facebook.",
        ]}
        relatedTools={[
          { href: "/tools/anonymous-instagram-viewer", label: "Anonymous Instagram viewer", body: "The same anonymous browsing experience, for Instagram." },
          { href: "/tools/anonymous-tiktok-viewer", label: "Anonymous TikTok viewer", body: "Browse a public TikTok profile's videos and followers." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
