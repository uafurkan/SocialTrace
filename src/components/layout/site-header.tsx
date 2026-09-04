import Link from "next/link";

import { copy } from "@/lib/copy";
import { Logo } from "@/components/layout/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ProfileSearchForm } from "@/components/home/profile-search-form";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid h-16 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 md:flex md:justify-between md:gap-0">
          <MobileNav />

          <Link
            href="/"
            className="flex items-center justify-center gap-2 font-semibold text-primary md:justify-start"
          >
            <Logo className="h-6 w-6" />
            <span className="tracking-tight">{copy.brand.name.toUpperCase()}</span>
          </Link>

          <span aria-hidden="true" className="md:hidden" />

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

        <div className="pb-3 md:hidden">
          <ProfileSearchForm size="compact" />
        </div>
      </div>
    </header>
  );
}
