import { count, desc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isDbConfigured, getDb, schema } from "@/lib/db";
import { resolveIdentityReadOnly } from "@/lib/auth/identity";
import { isAdminEmail } from "@/lib/auth/admin";
import { probeSources } from "@/lib/diagnostics/sources";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Admin",
  description: "Internal admin panel.",
  path: "/admin",
  noIndex: true,
});

function utcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function AdminPage() {
  if (!isDbConfigured()) {
    redirect("/");
  }

  // Mirrors /account's auth-gate pattern (src/app/account/page.tsx): a
  // non-authorized visitor (anonymous or a real, non-admin account) is
  // redirected the same way an unauthenticated visitor is bounced from
  // /account, rather than a 404 — no need for a distinct convention here.
  const identity = await resolveIdentityReadOnly();
  if (!identity.account || !isAdminEmail(identity.account.email)) {
    redirect("/");
  }

  const db = getDb();
  const [[totalUsers], [freeUsers], [proUsers], [todaysTranscriptions], recentUsers, sources] = await Promise.all([
    db.select({ value: count() }).from(schema.users),
    db.select({ value: count() }).from(schema.users).where(eq(schema.users.plan, "free")),
    db.select({ value: count() }).from(schema.users).where(eq(schema.users.plan, "pro")),
    db
      .select({ value: count() })
      .from(schema.transcriptionUsage)
      .where(gte(schema.transcriptionUsage.createdAt, utcMidnight())),
    db
      .select({ email: schema.users.email, plan: schema.users.plan, createdAt: schema.users.createdAt })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(20),
    probeSources(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Admin</h1>
      <p className="mt-2 text-sm text-secondary">Signed in as {identity.account.email}.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-primary">
            {totalUsers.value}
            <p className="mt-1 text-sm font-normal text-secondary">
              {freeUsers.value} free / {proUsers.value} pro
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcriptions today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-primary">{todaysTranscriptions.value}</CardContent>
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-primary">Data sources</h2>
        <p className="mt-1 text-sm text-secondary">
          Whether this deployment&apos;s IP can reach the free Instagram source, and whether Apify&apos;s quota
          breaker is currently tripped.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instagram free source</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={sources.instagramPublic.ok ? "success" : "danger"}>
                {sources.instagramPublic.ok ? "Reachable" : "Blocked"}
              </Badge>
              <p className="mt-2 text-sm text-secondary">
                {sources.instagramPublic.status !== null ? `HTTP ${sources.instagramPublic.status}` : "No response"}
                {" · "}
                {sources.instagramPublic.latencyMs}ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apify quota breaker</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={sources.apify.quotaBreakerOpen ? "danger" : "success"}>
                {sources.apify.quotaBreakerOpen ? "Open (skipping calls)" : "Closed (normal)"}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-primary">Recent accounts</h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((row) => (
                <tr key={row.email} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-primary">{row.email}</td>
                  <td className="px-4 py-2">
                    <Badge variant={row.plan === "pro" ? "brand" : "neutral"}>{row.plan}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{row.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
