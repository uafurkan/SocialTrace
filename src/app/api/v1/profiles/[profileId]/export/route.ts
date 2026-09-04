import { NextRequest, NextResponse } from "next/server";

import { buildExportBundle } from "@/lib/export/build";
import { toExportJson, toExportXml, toMemberCsv, toPostCsv } from "@/lib/export/serialize";
import { ProfileNotFoundError } from "@/lib/providers";

const FORMATS = ["json", "xml", "csv"] as const;
type Format = (typeof FORMATS)[number];

const CONTENT_TYPE: Record<Format, string> = {
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

/**
 * Synchronous export endpoint (spec §29's job-queue/signed-URL pipeline is
 * out of scope — see docs/EXPORT.md). `profileId` in the path is unused
 * for lookup (providers only expose getProfile-by-username) but kept in
 * the route shape for consistency with the other /profiles/[profileId]/*
 * endpoints; the actual profile comes from the required `username` param.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const resource = (searchParams.get("resource") ?? "profile").toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }
  if (!FORMATS.includes(format as Format)) {
    return NextResponse.json({ error: "format must be json, xml, or csv" }, { status: 400 });
  }

  let bundle;
  try {
    bundle = await buildExportBundle(username);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    throw error;
  }

  let body: string;
  let filenamePart = "profile";
  if (format === "csv") {
    if (resource === "followers") body = toMemberCsv(bundle.followers);
    else if (resource === "following") body = toMemberCsv(bundle.following);
    else if (resource === "posts") body = toPostCsv(bundle.posts);
    else if (resource === "reels") body = toPostCsv(bundle.reels);
    else {
      return NextResponse.json(
        { error: "CSV export requires resource=followers|following|posts|reels" },
        { status: 400 },
      );
    }
    filenamePart = resource;
  } else if (format === "xml") {
    body = toExportXml(bundle);
  } else {
    body = toExportJson(bundle);
  }

  const filename = `socialtrace-${bundle.profile.username}-${filenamePart}.${format}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": CONTENT_TYPE[format as Format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
