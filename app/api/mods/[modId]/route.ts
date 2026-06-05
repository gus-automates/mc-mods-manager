import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ modId: string }> }) {
  const { modId } = await params;
  const mod = db.getMod(modId);
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const server = db.getServer(mod.server_id);
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const filePath = path.join(server.mods_path, mod.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.deleteMod(modId);
  return NextResponse.json({ ok: true });
}
