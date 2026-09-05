import { NextResponse } from "next/server";

/**
 * Ad partners (Ezoic included) require ads.txt to list this domain's
 * authorized sellers. Content is pasted verbatim from the Ezoic dashboard
 * (Settings > Ads.txt Manager) via env — not fabricated here — so unset
 * means no file, same opt-in pattern as every other integration in this
 * app rather than a guessed/placeholder value.
 */
export async function GET() {
  const content = process.env.EZOIC_ADS_TXT;
  if (!content) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain" },
  });
}
