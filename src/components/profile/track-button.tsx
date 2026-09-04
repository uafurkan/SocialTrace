"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

interface TrackButtonProps {
  profileId: string;
  username: string;
  initialTracked: boolean;
  available: boolean;
}

export function TrackButton({ profileId, username, initialTracked, available }: TrackButtonProps) {
  const [tracked, setTracked] = useState(initialTracked);
  const [isPending, setIsPending] = useState(false);

  async function toggle() {
    setIsPending(true);
    try {
      const res = await fetch(`/api/v1/profiles/${profileId}/track?username=${encodeURIComponent(username)}`, {
        method: tracked ? "DELETE" : "POST",
      });
      if (res.ok) setTracked(!tracked);
    } finally {
      setIsPending(false);
    }
  }

  if (!available) {
    return (
      <Button variant="primary" disabled title="Tracking requires a configured database, not available in this deployment.">
        {copy.profile.trackCta}
      </Button>
    );
  }

  return (
    <Button variant={tracked ? "secondary" : "primary"} onClick={toggle} loading={isPending}>
      {tracked ? (
        <>
          <BadgeCheck className="size-4" aria-hidden="true" />
          {copy.profile.trackedCta}
        </>
      ) : (
        copy.profile.trackCta
      )}
    </Button>
  );
}
