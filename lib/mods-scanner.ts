import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, Mod, MissingDep, Server } from "./db";
import { modrinth, ModrinthVersion } from "./modrinth";

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
  let hashMap: Record<string, ModrinthVersion> = {};

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

    // If the file on disk changed (e.g. a mod was updated in place under the
    // same filename), the cached update flags from the old version are stale.
    const fileChanged = !!existing?.sha512 && existing.sha512 !== f.hash;

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
      update_available: fileChanged ? false : (existing?.update_available ?? false),
      latest_version: fileChanged ? null : (existing?.latest_version ?? null),
      homepage_url: projectInfo?.slug
        ? `https://modrinth.com/mod/${projectInfo.slug}`
        : existing?.homepage_url ?? null,
    };
  });

  // Detect missing required dependencies
  const installedProjectIds = new Set(
    mods.filter((m) => m.modrinth_id).map((m) => m.modrinth_id!)
  );

  const missingDepIds = new Set<string>();
  for (const mod of mods) {
    if (!mod.sha512) continue;
    const ver = hashMap[mod.sha512];
    if (!ver?.dependencies) continue;
    for (const dep of ver.dependencies) {
      if (dep.dependency_type === "required" && dep.project_id && !installedProjectIds.has(dep.project_id)) {
        missingDepIds.add(dep.project_id);
      }
    }
  }

  const missingDepInfo: Record<string, { title: string; slug: string }> = {};
  await Promise.allSettled(
    [...missingDepIds].map(async (pid) => {
      try {
        const proj = await modrinth.getProject(pid);
        missingDepInfo[pid] = { title: proj.title, slug: proj.slug };
      } catch {}
    })
  );

  for (const mod of mods) {
    if (!mod.sha512) { mod.missing_deps = []; continue; }
    const ver = hashMap[mod.sha512];
    if (!ver?.dependencies) { mod.missing_deps = []; continue; }
    mod.missing_deps = ver.dependencies
      .filter((d) => d.dependency_type === "required" && d.project_id && !installedProjectIds.has(d.project_id))
      .map((d): MissingDep => ({
        project_id: d.project_id!,
        title: missingDepInfo[d.project_id!]?.title ?? d.project_id!,
        slug: missingDepInfo[d.project_id!]?.slug ?? d.project_id!,
      }));
  }

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
