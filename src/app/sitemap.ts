import type { MetadataRoute } from "next";

import { HELP_ARTICLES } from "@/lib/seo/help-articles";

/**
 * Only lists canonical, indexable static routes that exist in this build
 * (spec §113/§176). Per-profile URLs are dynamic and generated data, not
 * currently sitemapped — that belongs to a later phase once real profile
 * pages are backed by a real provider (avoids indexing sample/mock URLs).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.socialtrace.co";
  const now = new Date();

  const staticRoutes = [
    "/",
    "/tools",
    "/tools/instagram-follower-history",
    "/tools/instagram-follower-compare",
    "/tools/instagram-growth-tracker",
    "/tools/instagram-story-viewer",
    "/tools/anonymous-instagram-viewer",
    "/help",
    "/data-methodology",
    "/changelog",
    "/faq",
    "/pricing",
    "/privacy",
    "/terms",
  ];

  const helpRoutes = HELP_ARTICLES.map((article) => `/help/${article.slug}`);

  return [...staticRoutes, ...helpRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
  }));
}
