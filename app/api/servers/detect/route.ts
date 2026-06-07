import { NextRequest, NextResponse } from "next/server";
import { detectServerVersion } from "@/lib/version-detector";

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const result = detectServerVersion(filePath);
  return NextResponse.json(result);
}
