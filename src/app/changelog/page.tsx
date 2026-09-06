import type { Metadata } from "next";

import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { CHANGELOG_ENTRIES } from "@/lib/seo/changelog-entries";

const TITLE = "Changelog";
const DESCRIPTION =
  "What changed and when. Each entry lists a real feature that shipped and what it lets you do.";
const PATH = "/changelog";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd
        id="ld-changelog-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Changelog", path: "/changelog" },
        ])}
      />
      <h1 className="text-3xl font-semibold text-primary">{TITLE}</h1>
      <p className="mt-3 text-secondary">{DESCRIPTION}</p>

      <ol className="mt-10 space-y-10">
        {CHANGELOG_ENTRIES.map((entry) => (
          <li key={`${entry.date}-${entry.title}`} className="border-b border-border pb-8 last:border-0">
            <time className="text-xs font-semibold uppercase tracking-wide text-muted">
              {entry.date}
            </time>
            <h2 className="mt-2 text-xl font-semibold text-primary">{entry.title}</h2>
            <p className="mt-2 text-secondary">{entry.description}</p>
            <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-secondary">
              {entry.highlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
