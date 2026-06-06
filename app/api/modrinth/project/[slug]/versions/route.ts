import { NextRequest, NextResponse } from "next/server";
import { modrinth } from "@/lib/modrinth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = req.nextUrl;
  const loader = searchParams.get("loader") ?? "fabric";
  const version = searchParams.get("version") ?? "";
  try {
    let versions: Awaited<ReturnType<typeof modrinth.getVersions>> = [];
    try {
      versions = await modrinth.getVersions(slug, loader, version);
    } catch {
      // fall through to unfiltered fetch
    }
    if (versions.length === 0) {
      versions = await modrinth.getAllVersions(slug);
    }
    return NextResponse.json(versions);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
