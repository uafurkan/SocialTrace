import type { Metadata } from "next";

import { copy } from "@/lib/copy";

/**
 * Every real content page should set its own `openGraph`/`twitter`, not
 * rely on inheriting the root layout's — Next.js does NOT recompute a
 * parent's `openGraph.title`/`description` from a child's own `title`/
 * `description`, so a page that only sets `title`/`description` shares
 * *the homepage's* social-preview copy when linked on Twitter/Slack/
 * Discord/etc. This was true of every non-home page before this helper
 * existed. `pageMetadata()` is the one place that's fixed, so every call
 * site gets a correct link preview for free instead of the copy having
 * to be duplicated three ways per page.
 */
interface PageMetadataParams {
  title: string;
  description: string;
  path: string;
  /** Pages with no independent SEO value (account, login, signup, the
   * cookie-scoped tracking dashboard) — crawlable (so nav links resolve
   * cleanly and internal link equity isn't wasted) but excluded from the
   * index, the standard pattern for account-gated/personalized pages. */
  noIndex?: boolean;
}

export function pageMetadata({ title, description, path, noIndex }: PageMetadataParams): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: copy.brand.name,
      title,
      description,
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
