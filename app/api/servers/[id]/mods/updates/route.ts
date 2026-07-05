import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modrinth } from "@/lib/modrinth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mods = db.getModsByServer(id).filter((m) => m.sha512 && m.modrinth_id);
  if (mods.length === 0) return NextResponse.json({ updated: 0 });

  const hashes = mods.map((m) => m.sha512!);

  try {
    const latestMap = await modrinth.checkUpdates(
      hashes,
      [server.loader],
      [server.mc_version]
    );

    let updatedCount = 0;
    for (const mod of mods) {
      const latest = latestMap[mod.sha512!];
      if (!latest) continue;

      // ponytail: Modrinth returns the newest version matching the filters,
      // but with no guarantee it's still tagged for our exact game version
      // (a file can list multiple game_versions, e.g. current + upcoming
      // snapshot) — so double check here instead of trusting the filter.
      const hasUpdate =
        latest.game_versions.includes(server.mc_version) && latest.version_number !== mod.version;
      if (mod.update_available !== hasUpdate || mod.latest_version !== latest.version_number) {
        db.updateModField(mod.id, "update_available", hasUpdate);
        db.updateModField(mod.id, "latest_version", latest.version_number);
        if (hasUpdate) updatedCount++;
      }
    }

    return NextResponse.json({
      updated: updatedCount,
      mods: db.getModsByServer(id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
