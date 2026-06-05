import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ modId: string }> }) {
  const { modId } = await params;
  const mod = db.getMod(modId);
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const server = db.getServer(mod.server_id);
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const oldPath = path.join(server.mods_path, mod.filename);
  let newFilename: string;

  if (mod.enabled) {
    newFilename = mod.filename + ".disabled";
  } else {
    newFilename = mod.filename.replace(/\.disabled$/, "");
  }

  const newPath = path.join(server.mods_path, newFilename);

  if (!fs.existsSync(oldPath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  fs.renameSync(oldPath, newPath);

  db.updateModField(modId, "filename", newFilename);
  db.updateModField(modId, "enabled", !mod.enabled);

  return NextResponse.json({ ...mod, filename: newFilename, enabled: !mod.enabled });
}
