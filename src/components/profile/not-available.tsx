import { Info } from "lucide-react";

import { copy } from "@/lib/copy";

export function NotAvailable({ detail }: { detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-16 text-center">
      <Info className="size-5 text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-secondary">{copy.emptyStates.notAvailable}</p>
      {detail ? <p className="max-w-sm text-sm text-muted">{detail}</p> : null}
    </div>
  );
}
