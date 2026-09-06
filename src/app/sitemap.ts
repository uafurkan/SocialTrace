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
 */
type RouteTier = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] };

const ROUTE_TIERS: RouteTier[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },

  // The two real product hubs.
  { path: "/tools", priority: 0.9, changeFrequency: "weekly" },
  { path: "/transcribe", priority: 0.9, changeFrequency: "weekly" },

  // Search-intent landing pages behind each hub — real, distinct pages
  // per docs/SEO.md, not doorway pages.
  { path: "/tools/instagram-follower-history", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/instagram-follower-compare", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/instagram-growth-tracker", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/instagram-story-viewer", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/anonymous-instagram-viewer", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/anonymous-tiktok-viewer", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/anonymous-facebook-viewer", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcribe/youtube-transcript-generator", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcribe/tiktok-video-to-text", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcribe/instagram-reel-to-text", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcribe/facebook-video-to-text", priority: 0.7, changeFrequency: "monthly" },

  // Pricing sits between product pages and reference content — commercial
  // intent, but changes rarely.
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },

  // Reference/support content.
  { path: "/help", priority: 0.5, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/data-methodology", priority: 0.5, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.4, changeFrequency: "weekly" },

  // Legal — real, required, but never the reason someone finds the site.
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.socialtrace.co";
  const now = new Date();

  const tieredRoutes = ROUTE_TIERS.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const helpRoutes = HELP_ARTICLES.map((article) => ({
    url: `${base}/help/${article.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...tieredRoutes, ...helpRoutes];
}
