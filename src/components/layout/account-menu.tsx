"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

interface AccountState {
  status: "loading" | "anonymous" | "authenticated";
  email: string | null;
}

/**
 * Reads auth state client-side (GET /api/v1/auth/me) rather than in
 * SiteHeader itself — SiteHeader is shared by every page including the
 * static content pages (docs/SEO.md, docs/SEARCH.md's sibling SEO work),
 * and a server component reading the session cookie anywhere in a shared
 * layout forces the whole page tree into dynamic rendering (Next.js
 * opts out of static generation the moment cookies() is read). Isolating
 * that read to this one client island keeps /changelog, /help, the tool
 * landing pages, etc. statically prerendered.
 */
export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AccountState>({ status: "loading", email: null });
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data: { user: { email: string } | null }) => {
        if (cancelled) return;
        setState(data.user ? { status: "authenticated", email: data.user.email } : { status: "anonymous", email: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous", email: null });
      });
    return () => {
      cancelled = true;
    };
    // Re-check on every navigation — the header persists across client-side
    // route changes, so logging in on /login and landing on /account
    // wouldn't otherwise re-run this fetch and the header would keep
    // showing "Sign in" until a full page reload.
  }, [pathname]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      setState({ status: "anonymous", email: null });
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (state.status === "loading") {
    return <div className="h-9 w-24" aria-hidden="true" />;
  }

  if (state.status === "anonymous") {
    return (
      <div className="flex items-center gap-4 text-sm font-medium">
        <Link href="/login" className="text-secondary hover:text-primary">
          {copy.nav.signIn}
        </Link>
        <Link href="/signup" className="text-secondary hover:text-primary">
          {copy.nav.signUp}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/account" className="max-w-[12rem] truncate text-secondary hover:text-primary" title={state.email ?? ""}>
        {state.email}
      </Link>
      <Button variant="tertiary" size="sm" onClick={handleSignOut} disabled={isSigningOut}>
        {copy.nav.signOut}
      </Button>
    </div>
  );
}
