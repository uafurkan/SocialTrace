import { NextRequest, NextResponse } from "next/server";

import { ColdBudgetExceededError, createIpColdBudget, runWithColdBudget } from "@/lib/cache/cold-budget";
import { provider } from "@/lib/providers";
import { clientIdentifierFor } from "@/lib/rate-limit";

/**
 * Cursor-paginated, server-side-searched followers endpoint (spec §12,
 * §30, §33). The client must never fetch the whole dataset and filter in
 * the browser — this route is the search boundary.
 *
 * Only a cold list (a data-cache miss) is charged against the caller's budget
 * (cold-budget.ts). Paging through a list that is already cached is free.
 */
export const maxDuration = 60;

function isValidProfileId(profileId: string): boolean {
  return profileId.trim() !== "" && profileId.length <= 100 && !profileId.includes("/");
}

export async function GET(request: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  if (!isValidProfileId(params.profileId)) {
    return NextResponse.json({ error: "Invalid profile id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);
  const budget = createIpColdBudget(clientIdentifierFor(request));

  try {
    const page = await runWithColdBudget(budget, () => provider.getFollowers(params.profileId, cursor, limit, query));
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof ColdBudgetExceededError) {
      return NextResponse.json(
        { error: "Too many new lists requested. Please wait a few minutes before opening another." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    console.error("Followers lookup failed:", error);
    return NextResponse.json({ error: "Couldn't load followers right now. Try again shortly." }, { status: 502 });
  }
}
