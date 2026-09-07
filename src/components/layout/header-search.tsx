"use client";

import { usePathname } from "next/navigation";

import { ProfileSearchForm } from "@/components/home/profile-search-form";
import { HeaderVideoSearchForm } from "@/components/layout/header-video-search-form";

/**
 * The mobile header's compact search box means different things on
 * different sections of the site: a username/profile-link lookup
 * everywhere except the transcriber, where the same slot should paste a
 * video link straight into /transcribe instead — a username input there
 * would just be wrong.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  return pathname?.startsWith("/transcribe") ? <HeaderVideoSearchForm /> : <ProfileSearchForm size="compact" />;
}
