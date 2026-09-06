"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verified">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; verified?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("verified");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/resend-verification", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; verified?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the email right now.");
        return;
      }
      if (data.verified) {
        setStatus("verified");
        router.refresh();
        return;
      }
      startCooldown();
    } catch {
      setError("Couldn't send the email right now.");
    }
  }

  if (status === "verified") {
    return null; // parent re-renders on next load; this just removes the card without a full page reload
  }

  return (
    <Card className="mt-6 border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="text-base">{copy.auth.verifyEmailTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-secondary">
        <p>{copy.auth.verifyEmailBody}</p>
        <form onSubmit={handleVerify} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="verification-code" className="mb-1.5 block text-sm font-medium text-primary">
              {copy.auth.verifyEmailCodeLabel}
            </label>
            <Input
              id="verification-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              className="w-32 tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <Button type="submit" disabled={isSubmitting || code.length !== 6}>
            {isSubmitting ? "Please wait…" : copy.auth.verifyEmailCta}
          </Button>
          <Button type="button" variant="secondary" disabled={cooldown > 0} onClick={handleResend}>
            {cooldown > 0 ? copy.auth.resendCooldown(cooldown) : copy.auth.resendCta}
          </Button>
        </form>
        {error ? <p className="text-danger">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
