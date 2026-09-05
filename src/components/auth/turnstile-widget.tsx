"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    onTurnstileVerify?: (token: string) => void;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile challenge for login/signup (docs/AUTH.md). Renders
 * nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so the forms work
 * exactly as before Turnstile existed — same opt-in pattern as every other
 * integration in this app. The verified token is read server-side against
 * TURNSTILE_SECRET_KEY (src/lib/auth/turnstile.ts); this widget only
 * collects it.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  useEffect(() => {
    window.onTurnstileVerify = onVerify;
    return () => {
      delete window.onTurnstileVerify;
    };
  }, [onVerify]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-callback="onTurnstileVerify" />
    </>
  );
}
