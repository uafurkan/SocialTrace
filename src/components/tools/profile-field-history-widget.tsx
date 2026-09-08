"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractUsername } from "@/lib/profile-link";

/** Shared by the Bio History and Username History tool pages — both are thin lookups into the existing per-profile Changes tab, filtered by `field`. */
export function ProfileFieldHistoryWidget({ field }: { field: "bio" | "username" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const handle = extractUsername(value);
    if (!handle) {
      setError("Enter a full username or a valid Instagram profile link.");
      return;
    }
    setError(null);
    router.push(`/profile/${encodeURIComponent(handle)}/changes?field=${field}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
      <History className="ml-1 hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Username or profile link"
        aria-label="Instagram username or profile link"
        autoComplete="off"
        className="flex-1"
      />
      <Button type="submit" className="sm:w-auto">
        View history
      </Button>
      {error ? <p className="text-sm text-danger sm:basis-full">{error}</p> : null}
    </form>
  );
}
