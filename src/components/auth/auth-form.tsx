"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "@/components/auth/turnstile-widget";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/account");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <GoogleAuthButton mode={mode} />
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted">
        <div className="h-px flex-1 bg-border" />
        {copy.auth.orDivider}
        <div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-primary">
            {copy.auth.emailLabel}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-primary">
            {copy.auth.passwordLabel}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <TurnstileWidget onVerify={setTurnstileToken} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
        >
          {isSubmitting ? "Please wait…" : mode === "login" ? copy.auth.loginCta : copy.auth.signupCta}
        </Button>
      </form>
    </div>
  );
}
