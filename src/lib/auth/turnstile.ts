const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Opt-in bot protection for login/signup (same pattern as every other
 * real integration here — SOCIAL_PROVIDER, SENTRY_DSN, UPSTASH_*): with
 * TURNSTILE_SECRET_KEY unset, this always returns true so auth behaves
 * exactly as it did before Turnstile existed. Configured, a missing or
 * invalid token is rejected.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string | undefined | null, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification request failed:", error);
    return false;
  }
}
