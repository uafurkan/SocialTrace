import Link from "next/link";

import { ProfileSearchForm } from "@/components/home/profile-search-form";
import { HeroChart } from "@/components/home/hero-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-strong">
              {copy.brand.descriptor}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
              {copy.home.heroHeadline}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-secondary">{copy.home.heroSubhead}</p>
            <div className="mt-8 max-w-lg">
              <ProfileSearchForm />
              <p className="mt-3 text-sm text-muted">{copy.home.noAccountNote}</p>
            </div>
          </div>
          <HeroChart />
        </div>
      </section>

      <section id="explore" className="border-t border-border bg-surface-subtle py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {copy.home.valueCards.map((card) => (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-secondary">{card.body}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-lg text-primary">{copy.home.proofStatement}</p>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-primary">Look up a public profile</h2>
          <div className="mx-auto mt-6 max-w-md">
            <ProfileSearchForm />
          </div>
          <p className="mt-6 text-sm text-muted">
            Try{" "}
            <Link href="/profile/nike" className="text-brand-strong underline underline-offset-2">
              @nike
            </Link>{" "}
            or{" "}
            <Link href="/profile/smallcreator" className="text-brand-strong underline underline-offset-2">
              @smallcreator
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
