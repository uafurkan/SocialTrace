import Link from "next/link";

import { HeroSearchWidget } from "@/components/home/hero-search-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdSlot } from "@/components/ads/ad-slot";
import { copy } from "@/lib/copy";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Instagram & TikTok profile viewer — SocialTrace",
  description:
    "View public Instagram, TikTok and Facebook profiles without an account, see followers and following, and transcribe public videos to text.",
  path: "/",
});

// Crawlable links to the live landing pages. Each one is a real feature with its own page.
const POPULAR_TOOLS = [
  { href: "/tools/anonymous-instagram-viewer", label: "Anonymous Instagram viewer", body: "Posts, reels, stories, highlights and tagged posts, without signing in." },
  { href: "/tools/instagram-story-viewer", label: "Instagram story viewer", body: "A public profile's currently active stories." },
  { href: "/tools/instagram-highlights-viewer", label: "Instagram highlights viewer", body: "Story highlights, where the data provider supplies them." },
  { href: "/tools/instagram-reels-viewer", label: "Instagram reels viewer", body: "The latest reels, with a CSV export." },
  { href: "/tools/instagram-followers-export", label: "Instagram followers export", body: "Followers, following, posts or reels as CSV, or the full profile as JSON or XML." },
  { href: "/tools/instagram-post-likers", label: "Who liked an Instagram post", body: "The likers and comments on a public post." },
  { href: "/tools/anonymous-tiktok-viewer", label: "Anonymous TikTok viewer", body: "A public TikTok profile's videos and comments." },
  { href: "/tools/tiktok-follower-checker", label: "TikTok follower checker", body: "Search a TikTok account's followers and following lists." },
  { href: "/transcribe", label: "Video transcriber", body: "Public YouTube, TikTok, Instagram, Facebook and X videos, turned into text." },
];

export default function HomePage() {
  return (
    <div>
      <JsonLd id="ld-website" data={websiteJsonLd()} />
      <JsonLd id="ld-organization" data={organizationJsonLd()} />
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-strong">
          {copy.brand.descriptor}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          {copy.home.heroHeadline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-secondary">{copy.home.heroSubhead}</p>
        <div className="mt-8 flex justify-center">
          <HeroSearchWidget />
        </div>
        {/* Right below the search widget, never overlapping the input or button itself. */}
        <AdSlot placementId={100} className="mt-6" />
      </section>

      <section id="explore" className="border-t border-border bg-surface-subtle py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {copy.home.valueCards.map((card) => (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-secondary">{card.body}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-primary">Popular tools</h2>
          {/* Mobile: compact rows with the names only. Desktop: cards with descriptions. */}
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {POPULAR_TOOLS.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  className="block h-full rounded-card border border-border bg-surface px-4 py-3 transition hover:border-primary/40 sm:p-4"
                >
                  <span className="font-medium text-primary">{tool.label}</span>
                  <span className="mt-1 hidden text-sm text-secondary sm:block">{tool.body}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <Link href="/tools" className="inline-flex min-h-11 items-center font-medium text-brand-strong hover:underline sm:min-h-0">
              See all tools
            </Link>
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-lg text-primary">{copy.home.proofStatement}</p>
        </div>
      </section>
    </div>
  );
}
