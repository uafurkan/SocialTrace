"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

const usernameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(z.string().min(1, "Enter a username").max(30, "Username is too long"));

export function ProfileSearchForm({ size = "default" }: { size?: "default" | "compact" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = usernameSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid username");
      return;
    }
    setError(null);
    router.push(`/profile/${encodeURIComponent(result.data)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className={size === "compact" ? "flex gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.home.searchPlaceholder}
          aria-label="Instagram username"
          className="flex-1"
        />
        <Button type="submit" className="sm:w-auto">
          {copy.home.searchCta}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
