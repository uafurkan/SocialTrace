"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { copy } from "@/lib/copy";
import { AccountMenu } from "@/components/layout/account-menu";
import { TrackNavBadge } from "@/components/layout/track-nav-badge";

const links = [
  { href: "/#explore", label: copy.nav.explore, badge: false },
  { href: "/tracking", label: copy.nav.track, badge: true },
  { href: "/api", label: copy.nav.api, badge: false },
  { href: "/pricing", label: copy.nav.pricing, badge: false },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-button text-secondary hover:bg-surface-subtle hover:text-primary"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-20 bg-primary/20 backdrop-blur-[1px] md:hidden"
          />
          <div className="absolute inset-x-0 top-16 z-30 border-b border-border bg-surface px-4 py-4 shadow-default">
            <nav className="flex flex-col gap-1 text-sm font-medium text-secondary">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-button px-2 py-2.5 hover:bg-surface-subtle hover:text-primary"
                >
                  {link.label}
                  {link.badge ? <TrackNavBadge /> : null}
                </Link>
              ))}
            </nav>
            <div className="mt-3 border-t border-border pt-3">
              <AccountMenu />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
