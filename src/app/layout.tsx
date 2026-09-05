import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { copy } from "@/lib/copy";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://socialtrace.example.com"),
  title: {
    default: `${copy.brand.name} — ${copy.brand.descriptor}`,
    template: `%s — ${copy.brand.name}`,
  },
  description: copy.home.heroSubhead,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
  headers();

  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
