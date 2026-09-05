import { NextResponse } from "next/server";

/**
 * Ezoic's own onboarding docs (Ads.txt Setup) specify a 301 redirect to
 * their Ads.txt Manager as the standard non-WordPress integration —
 * Ezoic keeps the authorized-sellers list current there, so redirecting
 * beats copy-pasting a static snapshot that goes stale. The target URL
 * (site-id-specific, e.g. https://srv.adstxtmanager.com/19390/socialtrace.co)
 * comes from env, not fabricated here — unset means no redirect, same
 * opt-in pattern as every other integration in this app.
 */
export async function GET() {
  const target = process.env.EZOIC_ADS_TXT_URL;
  if (!target) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.redirect(target, 301);
}
