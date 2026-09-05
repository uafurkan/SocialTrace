import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { HELP_ARTICLES, getHelpArticle } from "@/lib/seo/help-articles";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  const article = getHelpArticle(params.slug);
  if (!article) return { title: "Help article not found" };
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/help/${article.slug}` },
  };
}

export default async function HelpArticlePage(props: Params) {
  const params = await props.params;
  const article = getHelpArticle(params.slug);
  if (!article) notFound();

  const path = `/help/${article.slug}`;
  const paragraphs = article.body.split("\n\n").filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd
        id="ld-help-article"
        data={articleJsonLd({
          title: article.title,
          description: article.description,
          path,
          datePublished: article.datePublished,
        })}
      />
      <JsonLd
        id="ld-help-article-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Help", path: "/help" },
          { name: article.title, path },
        ])}
      />
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {article.section}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-primary">{article.title}</h1>
      <p className="mt-3 text-secondary">{article.description}</p>

      <div className="mt-8 space-y-5 text-secondary leading-relaxed">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-sm">
        <Link className="text-brand hover:underline" href="/help">
          ← All help articles
        </Link>
        <Link className="text-brand hover:underline" href="/data-methodology">
          Data methodology
        </Link>
      </div>
    </article>
  );
}
