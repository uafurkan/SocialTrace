import { NextRequest, NextResponse } from "next/server";

import { provider } from "@/lib/providers";

export const maxDuration = 60;

export async function GET(request: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);

  try {
    const page = await provider.getFollowing(params.profileId, cursor, limit, query);
    return NextResponse.json(page);
  } catch (error) {
    console.error("Following lookup failed:", error);
    return NextResponse.json({ error: "Couldn't load following right now. Try again shortly." }, { status: 502 });
  }
}
