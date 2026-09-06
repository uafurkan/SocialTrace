import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pageMetadata } from "@/lib/seo/metadata";
import { isPaddleConfigured } from "@/lib/billing/paddle";
import { PLAN_LIMITS } from "@/lib/billing/plans";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: "SocialTrace plans for public profile exploration and tracking.",
  path: "/pricing",
});

export default function PricingPage() {
  const paddleConfigured = isPaddleConfigured();
  const { maxTrackedProfiles, maxSavedSearches } = PLAN_LIMITS.free;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Pricing</h1>
      <p className="mt-2 text-secondary">
        Free is real and enforced today.{" "}
        {paddleConfigured ? "Pro is available now." : "Pro isn't purchasable yet."}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Free</CardTitle>
            <Badge variant="neutral">Current</Badge>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            Public profile exploration works without an account. With one (
            <Link href="/signup" className="text-brand hover:underline">
              sign up
            </Link>
            ), up to {maxTrackedProfiles} tracked profiles and {maxSavedSearches} saved searches follow you
            across devices.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pro</CardTitle>
            <Badge variant="brand">{paddleConfigured ? "Available" : "Coming soon"}</Badge>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            Unlimited tracked profiles and saved searches.{" "}
            {paddleConfigured ? (
              <>
                <Link href="/signup" className="text-brand hover:underline">
                  Sign up
                </Link>{" "}
                and upgrade from your account page.
              </>
            ) : (
              "The limit is already built and enforced — there's just no way to pay for Pro yet."
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
