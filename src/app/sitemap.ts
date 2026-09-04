import type { MetadataRoute } from "next";

/**
 * Only lists canonical, indexable static routes that exist in this build
 * (spec §113/§176). Per-profile URLs are dynamic and generated data, not
 * currently sitemapped — that belongs to a later phase once real profile
 * pages are backed by a real provider (avoids indexing sample/mock URLs).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://socialtrace.example.com";
  const staticRoutes = ["/", "/tools", "/pricing", "/api", "/privacy", "/terms"];

  return staticRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));
}
