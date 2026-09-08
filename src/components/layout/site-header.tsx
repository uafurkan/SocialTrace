import Link from "next/link";

import { copy } from "@/lib/copy";
import { BrandMark } from "@/components/layout/brand-mark";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TrackNavBadge } from "@/components/layout/track-nav-badge";
import { HeaderSearch } from "@/components/layout/header-search";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid h-16 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 md:flex md:justify-between md:gap-0">
          <MobileNav />

          <BrandMark />

          <span aria-hidden="true" className="md:hidden" />

          <nav className="hidden items-center gap-6 text-sm font-medium text-secondary md:flex">
            <Link href="/#explore" className="hover:text-primary">
              {copy.nav.explore}
            </Link>
            <Link href="/tracking" className="flex items-center hover:text-primary">
              {copy.nav.track}
              <TrackNavBadge />
            </Link>
            <Link href="/transcribe" className="hover:text-primary">
              {copy.nav.transcribe}
            </Link>
            <Link href="/tools" className="hover:text-primary">
              {copy.nav.tools}
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
          <HeaderSearch />
        </div>
      </div>
    </header>
  );
}
