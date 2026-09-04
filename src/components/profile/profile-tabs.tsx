"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface ProfileTabsProps {
  username: string;
}

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "posts", label: "Posts" },
  { slug: "reels", label: "Reels" },
  { slug: "stories", label: "Stories" },
  { slug: "highlights", label: "Highlights" },
  { slug: "followers", label: "Followers" },
  { slug: "following", label: "Following" },
  { slug: "history", label: "History" },
  { slug: "changes", label: "Changes" },
];

export function ProfileTabs({ username }: ProfileTabsProps) {
  const pathname = usePathname();
  const base = `/profile/${username}`;

  return (
    <nav
      aria-label="Profile sections"
      className="flex items-center gap-1 overflow-x-auto border-b border-border scrollbar-none"
    >
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-3.5 text-sm font-medium text-secondary transition-colors hover:text-primary",
              isActive && "border-brand text-brand-strong",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
