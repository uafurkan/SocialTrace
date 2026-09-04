"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: "Full profile — JSON", format: "json" as const },
  { label: "Full profile — XML", format: "xml" as const },
  { label: "Followers — CSV", format: "csv" as const, resource: "followers" },
  { label: "Following — CSV", format: "csv" as const, resource: "following" },
  { label: "Posts — CSV", format: "csv" as const, resource: "posts" },
  { label: "Reels — CSV", format: "csv" as const, resource: "reels" },
];

export function ExportMenu({ profileId, username }: { profileId: string; username: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function hrefFor(option: (typeof OPTIONS)[number]) {
    const params = new URLSearchParams({ username, format: option.format });
    if ("resource" in option && option.resource) params.set("resource", option.resource);
    return `/api/v1/profiles/${profileId}/export?${params.toString()}`;
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="tertiary" className="w-full" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen}>
        <Download className="size-4" aria-hidden="true" />
        {copy.profile.exportCta}
        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
      </Button>

      {isOpen ? (
        <ul className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-card border border-border bg-surface shadow-elevated">
          {OPTIONS.map((option) => (
            <li key={option.label}>
              <a
                href={hrefFor(option)}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2.5 text-left text-sm text-secondary hover:bg-surface-subtle hover:text-primary"
              >
                {option.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
