import type { MetadataRoute } from "next";

import { HELP_ARTICLES } from "@/lib/seo/help-articles";

/**
 * Only lists canonical, indexable static routes that exist in this build
 * (spec §113/§176). Per-profile URLs are dynamic and generated data, not
 * currently sitemapped — that belongs to a later phase once real profile
 * pages are backed by a real provider (avoids indexing sample/mock URLs).
 *
 * `priority` and `changeFrequency` are both optional hints search engines
 * are free to ignore, but a flat sitemap (every URL at the same implicit
 * priority) gives crawlers no signal about which pages matter most —
 * these tiers mirror the site's actual information architecture: the
 * homepage and the two live product surfaces (Instagram viewer, video
 * transcriber) rank above their own sub-pages, which rank above reference/
 * legal content that rarely changes.
 *
 * `lastModified` is a real, hand-maintained date per route — the actual
 * commit date of that route's `page.tsx` (`git log -1 --format=%aI --
 * <file>`), not `new Date()` on every build. Stamping every URL with
 * "today" on every deploy is the opposite of what `lastModified` is for:
 * it tells crawlers every page changed when almost none did, which
 * research into how search engines actually use sitemap hints says gets
 * a sitemap's `lastmod` values discounted over time — the same "don't
 * fabricate a signal" rule this file already applies to `priority`/
 * `changeFrequency`. Update a route's date here when you actually change
 * that page's content, the same discipline `HELP_ARTICLES`' own
 * `datePublished` already follows.
 */
type RouteTier = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  lastModified: string;
};

const ROUTE_TIERS: RouteTier[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily", lastModified: "2026-09-06" },

  // The two real product hubs.
  { path: "/tools", priority: 0.9, changeFrequency: "weekly", lastModified: "2026-09-06" },
  { path: "/transcribe", priority: 0.9, changeFrequency: "weekly", lastModified: "2026-09-08" },

  // Search-intent landing pages behind each hub — real, distinct pages
  // per docs/SEO.md, not doorway pages.
  { path: "/tools/instagram-follower-history", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/instagram-follower-compare", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/instagram-growth-tracker", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/instagram-story-viewer", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/anonymous-instagram-viewer", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/anonymous-tiktok-viewer", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/anonymous-facebook-viewer", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-06" },
  { path: "/tools/instagram-engagement-calculator", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/instagram-bio-history", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/instagram-follower-checker", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/instagram-following-checker", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/instagram-username-history", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/instagram-competitor-analyzer", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/username-availability-checker", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/hashtag-generator", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/tools/video-downloader", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/transcribe/youtube-transcript-generator", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/transcribe/tiktok-video-to-text", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/transcribe/instagram-reel-to-text", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },
  { path: "/transcribe/facebook-video-to-text", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-09-08" },

  // Pricing sits between product pages and reference content — commercial
  // intent, but changes rarely.
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-09-06" },

  // Reference/support content.
  { path: "/help", priority: 0.5, changeFrequency: "weekly", lastModified: "2026-09-07" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly", lastModified: "2026-09-07" },
  { path: "/data-methodology", priority: 0.5, changeFrequency: "monthly", lastModified: "2026-09-07" },
  { path: "/changelog", priority: 0.4, changeFrequency: "weekly", lastModified: "2026-09-07" },

  // Legal — real, required, but never the reason someone finds the site.
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly", lastModified: "2026-09-06" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly", lastModified: "2026-09-06" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.socialtrace.co";

  const tieredRoutes = ROUTE_TIERS.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const helpRoutes = HELP_ARTICLES.map((article) => ({
    url: `${base}/help/${article.slug}`,
    lastModified: article.datePublished,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...tieredRoutes, ...helpRoutes];
}
