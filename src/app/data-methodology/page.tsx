import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { AdSlot } from "@/components/ads/ad-slot";

const TITLE = "Data methodology";
const DESCRIPTION =
  "How SocialTrace collects, caches, and reports public social profile data — including the coverage rule that governs every list.";
const PATH = "/data-methodology";
const PUBLISHED = "2026-09-04";
const MODIFIED = "2026-10-09";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function DataMethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd
        id="ld-methodology-article"
        data={articleJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH, datePublished: PUBLISHED, dateModified: MODIFIED })}
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
          Only publicly available profile data: display name, bio, verified state, follower and
          following counts, post and reel metadata, and where the data provider supplies them,
          stories, highlights, tagged posts, likers and comments on public posts. For follower and
          following lists, we include the public accounts captured up to the list limit. No private
          profiles and no login-required content.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">How we collect it</h2>
        <p className="text-secondary">
          The default build ships with a deterministic mock provider so nothing costs money out of
          the box. With <code className="rounded bg-surface px-1 py-0.5 text-xs">SOCIAL_PROVIDER=apify</code>{" "}
          and an Apify API token, an opt-in real provider fetches public data via Apify actors, with a
          fallback chain across five follower-scraper actors so a single actor failing does not break
          the lookup. What a provider can supply varies: when a section such as highlights isn&apos;t
          available, the page says so instead of showing an empty list. See{" "}
          <Link className="text-brand hover:underline" href="/help/getting-started">
            Getting started
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">Coverage — the honesty rule</h2>
        <p className="text-secondary">
          Each follower or following list holds up to 500 accounts per load. For larger accounts
          that means the list is genuinely partial, and the coverage figure shows exactly what share
          of the real list is included (for example, &quot;Indexed 500 of 12,400 — Coverage 4%&quot;).
          Searching or exporting a list only covers the part that was captured. We never display the
          total as if the included part were the whole.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">How long results are kept</h2>
        <p className="text-secondary">
          Some results are cached in a database so repeat visits load faster. Posts and reels are
          cached for a few hours, stories for about an hour, follower and following lists for up to two
          days, and LinkedIn profiles for a day. A cached result can be older than the profile is right
          now, and the page shows when it was last checked.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-primary">What this build does not do</h2>
        <ul className="list-disc space-y-2 pl-6 text-secondary">
          <li>No sign-in, accounts, or billing. The tools work without an account.</li>
          <li>No private accounts and no content that requires a login.</li>
          <li>No background updates. Data refreshes when someone opens a profile, subject to the cache windows above.</li>
          <li>No notifications and no tracking of profiles over time.</li>
        </ul>
        <p className="text-secondary">
          These limits are also listed in the{" "}
          <Link className="text-brand hover:underline" href="/changelog">
            changelog
          </Link>
          .
        </p>
      </section>

      <AdSlot placementId={111} className="mt-14" />
    </div>
  );
}
