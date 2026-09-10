import type { Metadata } from "next";

import { ToolLanding } from "@/components/seo/tool-landing";
import { LinkedInProfileViewerWidget } from "@/components/tools/linkedin-profile-viewer-widget";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const TITLE = "LinkedIn profile viewer";
const DESCRIPTION =
  "Paste a public LinkedIn profile link and see headline, about, current role, experience, education, and recent activity — no LinkedIn account or login required.";
const PATH = "/tools/linkedin-profile-viewer";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "Do I need a LinkedIn account to use this?",
    answer:
      "No. Paste a public profile's link (linkedin.com/in/username) or just the username, and we fetch what's publicly visible on that profile — no login, no LinkedIn session of any kind.",
  },
  {
    question: "Why can a lookup take up to a minute?",
    answer:
      "LinkedIn profile data has no free or fast API path — every lookup is fetched fresh through Bright Data's dataset service, which typically takes 15-50 seconds. A repeat lookup of the same profile within 24 hours is served from cache and returns instantly.",
  },
  {
    question: "Does this work on private profiles?",
    answer:
      "No — only what LinkedIn already shows to a logged-out visitor on a public profile page. A private or restricted profile returns an honest \"not found\" result rather than a guess, since LinkedIn itself doesn't distinguish the two to an unauthenticated request.",
  },
  {
    question: "What shows up in the result?",
    answer:
      "Name, headline, location, follower and connection counts, about section, current company and title, up to five recent roles and schools, and up to three recent posts — exactly what's public on the profile, nothing inferred or estimated.",
  },
];

export default function LinkedInProfileViewerPage() {
  return (
    <>
      <JsonLd
        id="ld-linkedin-profile-viewer-breadcrumb"
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: TITLE, path: PATH }])}
      />
      <JsonLd id="ld-linkedin-profile-viewer-faq" data={faqJsonLd(FAQ)} />
      <ToolLanding
        title={TITLE}
        lead="Paste a public LinkedIn profile link and see its headline, about section, current role, experience, education, and recent activity — without opening LinkedIn or signing in."
        widget={<LinkedInProfileViewerWidget />}
        howItWorks={[
          "Paste a LinkedIn profile link (linkedin.com/in/username) or just the username.",
          "We fetch what's publicly visible on that profile — no login required, on either end.",
          "See headline, about, followers, current role, experience, education, and recent posts in one view.",
        ]}
        features={[
          { title: "No LinkedIn login", body: "View a public profile's visible details without ever opening LinkedIn or signing in." },
          { title: "Full public profile", body: "Headline, about, location, followers, current role, up to 5 roles and schools, and recent posts." },
          { title: "Cached for speed", body: "A repeat lookup of the same profile within 24 hours returns instantly instead of re-fetching." },
          { title: "Public data only", body: "Only what LinkedIn already shows a logged-out visitor — nothing scraped from behind a login wall." },
        ]}
        limitations={[
          "A first-time lookup can take up to a minute — there's no fast/free path for LinkedIn data.",
          "Private or restricted profiles return \"not found,\" since LinkedIn doesn't distinguish the two to a logged-out request.",
          "Shows the 5 most recent roles/schools and 3 most recent posts, not full history.",
        ]}
        relatedTools={[
          { href: "/tools/username-availability-checker", label: "Username availability checker", body: "Check a handle across Instagram, TikTok, Facebook, and YouTube at once." },
          { href: "/tools/instagram-engagement-calculator", label: "Engagement calculator", body: "Calculate engagement rate for a public Instagram, TikTok, or Facebook profile." },
        ]}
        faq={FAQ}
      />
    </>
  );
}
