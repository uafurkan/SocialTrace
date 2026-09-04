const SITE_URL = "https://socialtrace.example.com";
const SITE_NAME = "SocialTrace";

function escapeForJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

interface JsonLdProps {
  id: string;
  data: Record<string, unknown>;
}

export function JsonLd({ id, data }: JsonLdProps) {
  return (
    // eslint-disable-next-line react/no-danger -- JSON-LD requires raw script content; escaped via escapeForJsonLd above.
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeForJsonLd(data) }}
    />
  );
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

interface ArticleParams {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}

export function articleJsonLd({ title, description, path, datePublished, dateModified }: ArticleParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: `${SITE_URL}${path}`,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

interface FaqItem {
  question: string;
  answer: string;
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
