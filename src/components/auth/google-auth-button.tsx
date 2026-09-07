import { copy } from "@/lib/copy";

/**
 * A plain <a> to the redirect-starting route, not a client-side fetch —
 * this has to be a real top-level navigation for Google's OAuth consent
 * screen to work at all. Rendered on both /login and /signup
 * unconditionally; if GOOGLE_CLIENT_ID/SECRET aren't configured the route
 * itself 501s with a clear message rather than this button silently
 * disappearing (keeps the two auth pages identical regardless of env).
 */
export function GoogleAuthButton({ mode }: { mode: "login" | "signup" }) {
  return (
    <a
      href={`/api/v1/auth/google?next=${encodeURIComponent("/account")}`}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface text-sm font-medium text-primary transition hover:bg-surface-subtle"
    >
      <svg viewBox="0 0 48 48" className="size-4 shrink-0" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 5.9 4.3C13.8 15.6 18.5 12.4 24 12.4c3.1 0 5.9 1.2 8 3.1l5.1-5.1C34 6.1 29.3 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.6 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.2 4.8C9.9 39.6 16.4 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.5 35.9 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"
        />
      </svg>
      {mode === "login" ? copy.auth.googleLoginCta : copy.auth.googleSignupCta}
    </a>
  );
}
