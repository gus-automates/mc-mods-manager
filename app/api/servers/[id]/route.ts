import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(server);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = db.getServer(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = db.updateServer(id, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.deleteServer(id);
  return NextResponse.json({ ok: true });
}
