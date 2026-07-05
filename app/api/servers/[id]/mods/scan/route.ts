import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanMods } from "@/lib/mods-scanner";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const mods = await scanMods(server);
    return NextResponse.json({ mods, server });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
