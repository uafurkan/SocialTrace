const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * Server-to-server redirect flow only (no Google Identity Services
 * script, no One Tap) — the browser only ever navigates full-page
 * between our own domain and accounts.google.com, so unlike Ezoic/
 * Turnstile this needs no CSP widening (see src/proxy.ts).
 */
export function isGoogleLoginConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Same hardcoded production origin used throughout src/lib/seo/* and
// src/app/sitemap.ts — this project has no NEXT_PUBLIC_SITE_URL env var,
// so matching that existing convention rather than inventing a new one.
// Google's OAuth console requires an exact, pre-registered redirect URI
// anyway, so this can't vary per-deployment the way some env values can.
const SITE_URL = "https://www.socialtrace.co";

function redirectUri(): string {
  return `${SITE_URL}/api/v1/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserinfo {
  sub: string;
  email: string;
  email_verified: boolean;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Exchanges the one-time authorization code for a real user identity — throws GoogleAuthError on any failure so the callback route can show one honest error page rather than a partial/broken login. */
export async function fetchGoogleAccount(code: string): Promise<{ googleId: string; email: string }> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new GoogleAuthError("Google rejected the login request. Please try again.");
  }
  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    throw new GoogleAuthError("Couldn't read your Google profile. Please try again.");
  }
  const profile = (await userRes.json()) as GoogleUserinfo;
  if (!profile.email || !profile.email_verified) {
    throw new GoogleAuthError("Your Google account has no verified email address.");
  }
  return { googleId: profile.sub, email: profile.email };
}
