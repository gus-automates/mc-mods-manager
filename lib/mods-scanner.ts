import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, Mod, Server } from "./db";
import { modrinth } from "./modrinth";

function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha512").update(buf).digest("hex");
}

export async function scanMods(server: Server): Promise<Mod[]> {
  const modsDir = server.mods_path;

  if (!fs.existsSync(modsDir)) {
    throw new Error(`Mods directory not found: ${modsDir}`);
  }

  const files = fs.readdirSync(modsDir).filter(
    (f) => f.endsWith(".jar") || f.endsWith(".jar.disabled")
  );

  // Hash all files
  const fileData: { filename: string; fullPath: string; hash: string; enabled: boolean }[] = [];
  for (const filename of files) {
    const fullPath = path.join(modsDir, filename);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    const hash = hashFile(fullPath);
    fileData.push({
      filename,
      fullPath,
      hash,
      enabled: !filename.endsWith(".disabled"),
    });
  }

  // Resolve hashes against Modrinth in one batch call
  const hashes = fileData.map((f) => f.hash);
  let hashMap: Record<string, { project_id: string; version_number: string; name: string; files: { hashes: { sha512: string }; url: string; filename: string; primary: boolean }[] }> = {};

  if (hashes.length > 0) {
    try {
      hashMap = await modrinth.resolveHashes(hashes);
    } catch {
      // If Modrinth is unreachable, proceed without metadata
    }
  }

  // Fetch project details for all unique project IDs
  const projectIds = [...new Set(Object.values(hashMap).map((v) => v.project_id))];
  const projectMap: Record<string, { slug: string; title: string; icon_url: string | null }> = {};
  await Promise.allSettled(
    projectIds.map(async (pid) => {
      try {
        const proj = await modrinth.getProject(pid);
        projectMap[pid] = { slug: proj.slug, title: proj.title, icon_url: proj.icon_url };
      } catch {}
    })
  );

  // Build mod records
  const existingMods = db.getModsByServer(server.id);
  const existingByFilename = Object.fromEntries(existingMods.map((m) => [m.filename, m]));

  const mods: Mod[] = fileData.map((f) => {
    const versionInfo = hashMap[f.hash];
    const projectInfo = versionInfo ? projectMap[versionInfo.project_id] : undefined;
    const existing = existingByFilename[f.filename];
    const stat = fs.statSync(f.fullPath);

    return {
      id: existing?.id ?? crypto.randomUUID(),
      server_id: server.id,
      filename: f.filename,
      modrinth_id: versionInfo?.project_id ?? existing?.modrinth_id ?? null,
      modrinth_slug: projectInfo?.slug ?? existing?.modrinth_slug ?? null,
      name: projectInfo?.title ?? existing?.name ?? stripJarExtension(f.filename),
      version: versionInfo?.version_number ?? existing?.version ?? null,
      icon_url: projectInfo?.icon_url ?? existing?.icon_url ?? null,
      enabled: f.enabled,
      last_modified: stat.mtime.toISOString(),
      provider: versionInfo ? "Modrinth" : (existing?.provider ?? "Local"),
      sha512: f.hash,
      update_available: existing?.update_available ?? false,
      latest_version: existing?.latest_version ?? null,
      homepage_url: projectInfo?.slug
        ? `https://modrinth.com/mod/${projectInfo.slug}`
        : existing?.homepage_url ?? null,
    };
  });

  // Persist
  db.upsertMods(mods);
  db.deleteModsNotIn(
    server.id,
    mods.map((m) => m.id)
  );

  return mods;
}

function stripJarExtension(filename: string): string {
  return filename.replace(/\.jar(\.disabled)?$/, "");
}
