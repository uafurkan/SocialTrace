import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { helpArticlesBySection } from "@/lib/seo/help-articles";

const TITLE = "Help center";
const DESCRIPTION =
  "How SocialTrace works — snapshots, coverage, tracking, comparisons, and exports, with the same honesty rules applied everywhere.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/help" },
};

export default function HelpIndexPage() {
  const sections = helpArticlesBySection();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <JsonLd
        id="ld-help-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Help", path: "/help" },
        ])}
      />
      <h1 className="text-3xl font-semibold text-primary">{TITLE}</h1>
      <p className="mt-3 max-w-2xl text-secondary">{DESCRIPTION}</p>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.section}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {section.section}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {section.articles.map((article) => (
                <Link key={article.slug} href={`/help/${article.slug}`}>
                  <Card className="h-full transition hover:border-primary/40">
                    <CardHeader>
                      <CardTitle className="text-base">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-secondary">
                      {article.description}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-primary">Methodology</h2>
        <p className="mt-2 text-secondary">
          Every dataset the product shows follows the same coverage rule.{" "}
          <Link className="text-brand hover:underline" href="/data-methodology">
            Read the data methodology
          </Link>{" "}
          for how we collect, index, and report — including exactly what &quot;coverage&quot;
          means and what this build does not do.
        </p>
      </div>
    </div>
  );
}
