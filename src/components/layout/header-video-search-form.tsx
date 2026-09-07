"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasteButton } from "@/components/ui/paste-button";
import { copy } from "@/lib/copy";
import { useInputHistory } from "@/lib/use-input-history";

/**
 * The mobile header's compact search box (see site-header.tsx) is
 * @username-shaped everywhere on the site except the transcriber pages,
 * where a username makes no sense — swaps it for a video-link box that
 * hands the URL to /transcribe's own `?url=` auto-submit, mirroring
 * ProfileSearchForm's shape (icon, paste button, per-device history) so
 * the header still looks like one consistent component.
 */
export function HeaderVideoSearchForm() {
  const [value, setValue] = useState("");
  const router = useRouter();
  const { history, addToHistory, listId } = useInputHistory("transcriber-url");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    addToHistory(trimmed);
    router.push(`/transcribe?url=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <div className="relative flex-1">
        <Link2
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.transcriber.urlPlaceholder}
          aria-label="Video URL"
          autoComplete="off"
          list={listId}
          className="pl-9 pr-20"
        />
        <PasteButton onPaste={setValue} />
        <datalist id={listId}>
          {history.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
      <Button type="submit" className="sm:w-auto">
        {copy.transcriber.submitCta}
      </Button>
    </form>
  );
}
