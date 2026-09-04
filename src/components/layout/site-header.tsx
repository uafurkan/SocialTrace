import Link from "next/link";

import { copy } from "@/lib/copy";
import { Logo } from "@/components/layout/logo";
import { AccountMenu } from "@/components/layout/account-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <Logo className="h-6 w-6" />
          <span className="tracking-tight">{copy.brand.name.toUpperCase()}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-secondary md:flex">
          <Link href="/#explore" className="hover:text-primary">
            {copy.nav.explore}
          </Link>
          <Link href="/tracking" className="hover:text-primary">
            {copy.nav.track}
          </Link>
          <Link href="/api" className="hover:text-primary">
            {copy.nav.api}
          </Link>
          <Link href="/pricing" className="hover:text-primary">
            {copy.nav.pricing}
          </Link>
        </nav>
        <div className="hidden items-center md:flex">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
