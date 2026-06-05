import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanMods } from "@/lib/mods-scanner";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Return cached mods; client can trigger /scan for fresh data
  const mods = db.getModsByServer(id);

  // If no mods cached yet, do an initial scan
  if (mods.length === 0) {
    try {
      const scanned = await scanMods(server);
      return NextResponse.json(scanned);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json(mods);
}
