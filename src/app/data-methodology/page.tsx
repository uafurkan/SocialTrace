import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";

const TITLE = "Data methodology";
const DESCRIPTION =
  "How SocialTrace collects, indexes, and reports Instagram public profile data — including the coverage rule that governs every dataset.";
const PATH = "/data-methodology";
const PUBLISHED = "2026-09-04";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

export default function DataMethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd
        id="ld-methodology-article"
        data={articleJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH, datePublished: PUBLISHED })}
      />
      <JsonLd
        id="ld-methodology-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Data methodology", path: PATH },
        ])}
      />
      <h1 className="text-3xl font-semibold text-primary">{TITLE}</h1>
      <p className="mt-3 text-secondary">{DESCRIPTION}</p>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">What we collect</h2>
        <p className="text-secondary">
          Only publicly available Instagram profile fields: display name, bio, verified state,
          follower and following counts, post and reel metadata, and the public identities behind
          the follower and following lists a snapshot successfully captures. No private profiles,
          no login-required content, no stories or highlights.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">How we collect it</h2>
        <p className="text-secondary">
          The default build ships with a deterministic mock provider so nothing costs money out of
          the box. With <code className="rounded bg-surface px-1 py-0.5 text-xs">SOCIAL_PROVIDER=apify</code>{" "}
          and an Apify API token, an opt-in real provider fetches Instagram public data via Apify
          actors, with a fallback chain across five follower-scraper actors so a single actor
          failing does not break capture. See{" "}
          <Link className="text-brand hover:underline" href="/help/getting-started">
            Getting started
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">Coverage — the honesty rule</h2>
        <p className="text-secondary">
          Every snapshot captures up to 500 followers and 500 following identities per profile.
          For larger accounts that means a snapshot&apos;s list is genuinely partial, and the coverage
          badge shows exactly what fraction of the real dataset the snapshot represents (for
          example, &quot;Indexed 500 of 12,400 — Coverage 4%&quot;). We never display the total as
          if the indexed subset were the total.
        </p>
        <p className="text-secondary">
          Comparisons — the automatic diff engine, the Compare snapshots page, and saved searches
          — are withheld when either side is below 99.5% coverage. Missing accounts below that
          threshold cannot be distinguished from real unfollows, so the honest answer is
          &quot;comparison unavailable&quot; rather than a fabricated list.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">How snapshots become diffs</h2>
        <p className="text-secondary">
          Each snapshot writes profile counts and one membership row per captured identity, with
          the timestamp it was first seen. When a subsequent snapshot runs, membership rows whose
          identity was not seen this time get a <code className="rounded bg-surface px-1 py-0.5 text-xs">removed_at</code>{" "}
          timestamp; identities newly present get a new membership row. Diffs are read off those
          two columns — no separate per-snapshot log is needed.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">What this build does not do</h2>
        <ul className="list-disc space-y-2 pl-6 text-secondary">
          <li>No sign-in, billing, or accounts — anonymous browser-cookie identity only.</li>
          <li>No scheduler — snapshots only run when someone captures one manually.</li>
          <li>No notification channel — the dashboard is pull, not push.</li>
          <li>No stories or highlights — no actor covers them in this build.</li>
        </ul>
        <p className="text-secondary">
          These are recorded honestly in the product itself and in the{" "}
          <Link className="text-brand hover:underline" href="/changelog">
            changelog
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
