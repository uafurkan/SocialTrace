import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { EzoicLoader } from "@/components/ads/ezoic-loader";
import { AdsenseLoader } from "@/components/ads/adsense-loader";
import { copy } from "@/lib/copy";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const defaultTitle = `${copy.brand.name} — ${copy.brand.descriptor}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.socialtrace.co"),
  title: {
    default: defaultTitle,
    template: `%s — ${copy.brand.name}`,
  },
  description: copy.home.heroSubhead,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: copy.brand.name,
    title: defaultTitle,
    description: copy.home.heroSubhead,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: copy.home.heroSubhead,
  },
  // Each is only rendered as a <meta> tag when the corresponding env var is
  // set — same opt-in pattern as every other real integration in this
  // project (SOCIAL_PROVIDER, SENTRY_DSN, ...). See .env.example.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.YANDEX_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers() here is required for Next.js to pick up and apply the
  // per-request CSP nonce (src/middleware.ts) to the script tags it emits —
  // without a Server Component in the tree actually calling headers(), Next
  // never learns the nonce, so every script tag ships with no nonce
  // attribute and the browser blocks all of them under 'strict-dynamic'
  // (confirmed live: every page's JS was inert, forms fell back to native
  // GET submission). This does mean every page under this layout is now
  // dynamically rendered rather than statically prerendered — an accepted
  // cost, since a site where no client-side script runs at all is broken,
  // not merely unoptimized.
  await headers();

  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <AdsenseLoader />
        <EzoicLoader />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
