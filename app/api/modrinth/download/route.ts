import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modrinth } from "@/lib/modrinth";

export async function POST(req: NextRequest) {
  const { server_id, project_slug, version_id, replace_filename } = await req.json();

  const server = db.getServer(server_id);
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    // Get versions and find the requested one (or latest)
    let versions: Awaited<ReturnType<typeof modrinth.getVersions>> = [];
    try {
      versions = await modrinth.getVersions(project_slug, server.loader, server.mc_version);
    } catch {
      // fall through to unfiltered fetch
    }
    if (versions.length === 0) {
      versions = await modrinth.getAllVersions(project_slug);
    }
    if (versions.length === 0) {
      return NextResponse.json(
        { error: "No compatible versions found" },
        { status: 404 }
      );
    }

    const version = version_id
      ? versions.find((v) => v.id === version_id) ?? versions[0]
      : versions[0];

    const primaryFile = version.files.find((f) => f.primary) ?? version.files[0];
    if (!primaryFile) {
      return NextResponse.json({ error: "No file found in version" }, { status: 404 });
    }

    // Download the file
    const res = await fetch(primaryFile.url, {
      headers: { "User-Agent": "McModsManager/1.0 (github.com/gus-automates/mc-mods-manager)" },
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const destPath = path.join(server.mods_path, primaryFile.filename);
    fs.writeFileSync(destPath, buffer);

    // If this download is replacing an older version with a different
    // filename, remove the old file so it doesn't linger as a duplicate.
    // Must happen after the new file is written, and only when the names
    // differ — otherwise we'd delete the file we just wrote.
    if (replace_filename && replace_filename !== primaryFile.filename) {
      const oldPath = path.join(server.mods_path, replace_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    return NextResponse.json({ ok: true, filename: primaryFile.filename });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
