import type { Metadata } from "next";

import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { FAQ_ENTRIES } from "@/lib/seo/faq-entries";

const TITLE = "Frequently asked questions";
const DESCRIPTION =
  "What SocialTrace does, what it does not do, and how coverage, snapshots, tracking, and exports actually work.";
const PATH = "/faq";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd id="ld-faq" data={faqJsonLd(FAQ_ENTRIES)} />
      <JsonLd
        id="ld-faq-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
      <h1 className="text-3xl font-semibold text-primary">{TITLE}</h1>
      <p className="mt-3 text-secondary">{DESCRIPTION}</p>

      <dl className="mt-10 space-y-8">
        {FAQ_ENTRIES.map((entry) => (
          <div key={entry.question} className="border-b border-border pb-6 last:border-0">
            <dt className="text-lg font-semibold text-primary">{entry.question}</dt>
            <dd className="mt-3 text-secondary leading-relaxed">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
