import { NextRequest, NextResponse } from "next/server";
import { modrinth } from "@/lib/modrinth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q") ?? "";
  const loader = searchParams.get("loader") ?? "fabric";
  const gameVersion = searchParams.get("version") ?? "";
  const env = (searchParams.get("env") ?? "both") as "client" | "server" | "both";

  try {
    const results = await modrinth.search(query, loader, gameVersion, env);
    return NextResponse.json(results);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
