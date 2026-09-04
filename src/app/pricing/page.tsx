import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing",
  description: "SocialTrace plans for public profile exploration and tracking.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Pricing</h1>
      <p className="mt-2 text-secondary">
        Billing is not enabled in this build. Planned tiers, subject to change:
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Free</CardTitle>
            <Badge variant="neutral">Current</Badge>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            Basic public profile exploration with limited tracking and exports.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pro</CardTitle>
            <Badge variant="brand">Coming soon</Badge>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            Higher limits, watchlists, historical comparisons, exports and alerts.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
