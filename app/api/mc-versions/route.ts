import { NextResponse } from "next/server";

const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

let cache: { versions: string[]; expiresAt: number } | null = null;

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.versions);
  }

  const res = await fetch(MANIFEST_URL);
  const data = await res.json();

  const versions: string[] = data.versions
    .filter((v: { type: string }) => v.type === "release")
    .map((v: { id: string }) => v.id);

  cache = { versions, expiresAt: Date.now() + 60 * 60 * 1000 };

  return NextResponse.json(versions);
}
