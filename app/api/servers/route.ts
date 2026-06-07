import { NextRequest, NextResponse } from "next/server";
import { db, resolveModsPath } from "@/lib/db";

export async function GET() {
  const servers = db.getServers();
  const withCounts = servers.map((s) => ({
    ...s,
    mod_count: db.getModsByServer(s.id).length,
  }));
  return NextResponse.json(withCounts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, mods_path, mc_version, loader, env } = body;

  if (!name || !mods_path || !mc_version) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const resolvedPath = resolveModsPath(mods_path);

  const server = db.createServer({
    name,
    mods_path: resolvedPath,
    mc_version,
    loader: loader ?? "fabric",
    env: env ?? "both",
  });

  return NextResponse.json(server, { status: 201 });
}
