import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /account, /login, /signup, /tracking are personalized/no-SEO-value
      // pages, but excluded from crawling here would let Google surface
      // them as bare "blocked by robots.txt" index entries if anything ever
      // links to them — a real robots noindex meta tag (pageMetadata's
      // noIndex option, src/lib/seo/metadata.ts) requires crawling to be
      // seen, so those pages stay crawlable and rely on that instead. Only
      // /api/ is disallowed here — it's not a page, there's nothing a
      // noindex tag could attach to.
      disallow: ["/api/"],
    },
    sitemap: "https://www.socialtrace.co/sitemap.xml",
  };
}
