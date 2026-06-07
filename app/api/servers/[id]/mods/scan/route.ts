import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanMods } from "@/lib/mods-scanner";
import { detectServerVersion } from "@/lib/version-detector";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const mods = await scanMods(server);

    // Re-detect version/loader and update if changed
    const detected = detectServerVersion(server.mods_path);
    const patch: { mc_version?: string; loader?: string } = {};
    if (detected.mc_version && detected.mc_version !== server.mc_version) {
      patch.mc_version = detected.mc_version;
    }
    if (detected.loader && detected.loader !== server.loader) {
      patch.loader = detected.loader;
    }
    const updatedServer = Object.keys(patch).length > 0
      ? db.updateServer(id, patch)
      : server;

    return NextResponse.json({ mods, server: updatedServer ?? server });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
