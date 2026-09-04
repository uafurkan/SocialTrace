import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ToolLandingProps {
  title: string;
  lead: string;
  primaryCta: { href: string; label: string };
  howItWorks: string[];
  features: Array<{ title: string; body: string }>;
  limitations: string[];
  relatedTools: Array<{ href: string; label: string; body: string }>;
  faq: Array<{ question: string; answer: string }>;
}

export function ToolLanding(props: ToolLandingProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-primary sm:text-4xl">{props.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-secondary">{props.lead}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href={props.primaryCta.href}>{props.primaryCta.label}</Link>
        </Button>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-primary">How it works</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-secondary">
          {props.howItWorks.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-primary">Features</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {props.features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-secondary">{feature.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-primary">Limitations</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-secondary">
          {props.limitations.map((limitation, index) => (
            <li key={index}>{limitation}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          See{" "}
          <Link className="text-brand hover:underline" href="/data-methodology">
            data methodology
          </Link>{" "}
          for the coverage rules that apply everywhere.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-primary">FAQ</h2>
        <dl className="mt-4 space-y-6">
          {props.faq.map((entry) => (
            <div key={entry.question}>
              <dt className="font-semibold text-primary">{entry.question}</dt>
              <dd className="mt-2 text-secondary">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-primary">Related tools</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {props.relatedTools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Card className="h-full transition hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="text-base">{tool.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-secondary">{tool.body}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
