import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isDbConfigured, getDb, schema } from "@/lib/db";
import { resolveIdentityReadOnly } from "@/lib/auth/identity";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { isPaddleConfigured } from "@/lib/billing/paddle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeButton, ManageBillingButton } from "@/components/billing/checkout-button";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Account",
  description: "Your SocialTrace account, plan, and usage.",
  path: "/account",
  noIndex: true,
});

function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : "Unlimited";
}

export default async function AccountPage() {
  if (!isDbConfigured()) {
    redirect("/");
  }

  const identity = await resolveIdentityReadOnly();
  if (!identity.account) {
    redirect("/login");
  }

  const db = getDb();
  const [[trackedRow], [savedRow]] = await Promise.all([
    db.select({ value: count() }).from(schema.watchlistEntries).where(eq(schema.watchlistEntries.visitorId, identity.scopeId)),
    db.select({ value: count() }).from(schema.savedSearches).where(eq(schema.savedSearches.visitorId, identity.scopeId)),
  ]);

  const limits = PLAN_LIMITS[identity.account.plan];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Account</h1>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{identity.account.email}</CardTitle>
          <Badge variant={identity.account.plan === "pro" ? "brand" : "neutral"}>
            {identity.account.plan === "pro" ? "Pro" : "Free"} plan
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-secondary">
          <div className="flex items-center justify-between">
            <span>Tracked profiles</span>
            <span className="font-medium text-primary">
              {trackedRow.value} / {formatLimit(limits.maxTrackedProfiles)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Saved searches</span>
            <span className="font-medium text-primary">
              {savedRow.value} / {formatLimit(limits.maxSavedSearches)}
            </span>
          </div>
        </CardContent>
      </Card>

      {identity.account.plan === "free" ? (
        <div className="mt-6 rounded-card border border-border bg-surface-subtle p-5">
          <p className="text-sm font-medium text-primary">Upgrade to Pro</p>
          <p className="mt-1 text-sm text-secondary">Unlimited tracked profiles and saved searches.</p>
          <div className="mt-4">
            {isPaddleConfigured() ? (
              <UpgradeButton />
            ) : (
              <Button disabled title="Coming soon — billing isn't enabled in this build">
                Upgrade — coming soon
              </Button>
            )}
          </div>
        </div>
      ) : (
        isPaddleConfigured() && (
          <div className="mt-6 rounded-card border border-border bg-surface-subtle p-5">
            <p className="text-sm font-medium text-primary">Manage your subscription</p>
            <p className="mt-1 text-sm text-secondary">Update your payment method, view invoices, or cancel.</p>
            <div className="mt-4">
              <ManageBillingButton />
            </div>
          </div>
        )
      )}

      <p className="mt-8 text-sm text-secondary">
        Tracked profiles and saved searches made while signed in follow this account across browsers
        and devices — see the <a className="text-brand hover:underline" href="/tracking">tracking dashboard</a>.
      </p>
    </div>
  );
}
