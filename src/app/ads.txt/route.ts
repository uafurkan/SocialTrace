import { NextResponse } from "next/server";

/**
 * Ezoic's own onboarding docs (Ads.txt Setup) specify a 301 redirect to
 * their Ads.txt Manager as the standard non-WordPress integration —
 * Ezoic keeps the authorized-sellers list current there, so redirecting
 * beats copy-pasting a static snapshot that goes stale. The target URL
 * (site-id-specific, e.g. https://srv.adstxtmanager.com/19390/socialtrace.co)
 * comes from env, not fabricated here — unset means no redirect, same
 * opt-in pattern as every other integration in this app.
 *
 * While Ezoic isn't linked yet (its ads.txt manager would otherwise carry
 * the Google line too), AdSense needs its own authorized-seller line
 * served directly: `google.com, pub-<id>, DIRECT, f08c47fec0942fa0` is
 * Google's own documented static format — no per-account URL to redirect
 * to. Derived from the same client id as the loader script
 * (NEXT_PUBLIC_ADSENSE_CLIENT_ID="ca-pub-<id>") so there's only one id to
 * configure.
 */
export async function GET() {
  const ezoicTarget = process.env.EZOIC_ADS_TXT_URL;
  if (ezoicTarget) {
    return NextResponse.redirect(ezoicTarget, 301);
  }

  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const pubId = adsenseClientId?.match(/^ca-(pub-\d+)$/)?.[1];
  if (pubId) {
    return new NextResponse(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Not found", { status: 404 });
}
