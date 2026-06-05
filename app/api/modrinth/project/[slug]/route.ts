import { NextRequest, NextResponse } from "next/server";
import { modrinth } from "@/lib/modrinth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const project = await modrinth.getProject(slug);
    return NextResponse.json(project);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
