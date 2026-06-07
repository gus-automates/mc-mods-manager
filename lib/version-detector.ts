import fs from "fs";
import path from "path";

interface DetectResult {
  mc_version?: string;
  loader?: string;
  env?: "client" | "server";
}

/** Walk up from a mods folder to the server root, if needed. */
function resolveServerRoot(inputPath: string): string {
  const normalized = inputPath.trim();
  if (path.basename(normalized).toLowerCase() === "mods") {
    return path.dirname(normalized);
  }
  return normalized;
}

/**
 * Try to detect the Minecraft version and mod loader from a server directory.
 * Accepts either the server root or the mods subfolder.
 */
export function detectServerVersion(serverRootOrModsPath: string): DetectResult {
  const root = resolveServerRoot(serverRootOrModsPath);
  const result: DetectResult = {};

  if (!fs.existsSync(root)) return result;

  // 1. version.json — present on vanilla and most modded servers
  const versionJson = path.join(root, "version.json");
  if (fs.existsSync(versionJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionJson, "utf-8"));
      if (typeof data.id === "string" && /^\d+\.\d+/.test(data.id)) {
        result.mc_version = data.id;
      }
    } catch {}
  }

  // 2. Scan jar files in the server root for loader/version signals
  let files: string[] = [];
  try {
    files = fs.readdirSync(root).filter((f) => f.endsWith(".jar"));
  } catch {}

  for (const file of files) {
    // Fabric: fabric-server-mc.1.21.5-loader.0.16.14-launcher.1.0.3.jar
    const fabricMatch = file.match(/^fabric-server-mc\.(\d+\.\d+[\d.]*)[-_]/i);
    if (fabricMatch) {
      if (!result.mc_version) result.mc_version = fabricMatch[1];
      result.loader = "fabric";
      break;
    }

    // Fabric launch jars (no version info in name)
    if (file === "fabric-server-launch.jar" || file === "fabric.jar") {
      result.loader = "fabric";
      continue;
    }

    // Forge: forge-1.20.1-47.2.0.jar
    const forgeMatch = file.match(/^forge-(\d+\.\d+[\d.]*)-[\d.]+\.jar$/i);
    if (forgeMatch) {
      if (!result.mc_version) result.mc_version = forgeMatch[1];
      result.loader = "forge";
      break;
    }

    // NeoForge: neoforge-21.1.0.jar — MC version lives in libraries path
    const neoforgeMatch = file.match(/^neoforge-[\d.]+\.jar$/i);
    if (neoforgeMatch) {
      result.loader = "neoforge";
      // Try to read MC version from libraries directory
      const mcVersionFromLibs = detectMcVersionFromLibraries(root);
      if (mcVersionFromLibs && !result.mc_version) result.mc_version = mcVersionFromLibs;
      break;
    }

    // Quilt
    if (file === "quilt-server-launch.jar") {
      result.loader = "quilt";
      continue;
    }
  }

  // 3. NeoForge fallback: libraries/ path without a neoforge jar in root
  if (!result.loader && !result.mc_version) {
    const fromLibs = detectMcVersionFromLibraries(root);
    if (fromLibs) result.mc_version = fromLibs;
  }

  // 4. versions/ directory fallback (Crafty Controller and some other launchers)
  if (!result.mc_version) {
    const fromVersionsDir = detectMcVersionFromVersionsDir(root);
    if (fromVersionsDir) result.mc_version = fromVersionsDir;
  }

  // 5. Detect environment: server vs client
  const serverIndicators = ["server.properties", "eula.txt"];
  const clientIndicators = ["options.txt"];
  const isServer = serverIndicators.some((f) => fs.existsSync(path.join(root, f)));
  const isClient =
    clientIndicators.some((f) => fs.existsSync(path.join(root, f))) ||
    fs.existsSync(path.join(root, "saves"));
  if (isServer && !isClient) result.env = "server";
  else if (isClient && !isServer) result.env = "client";

  return result;
}

/** Check versions/<version>/ directory (Crafty Controller and some launchers). */
function detectMcVersionFromVersionsDir(serverRoot: string): string | undefined {
  const versionsDir = path.join(serverRoot, "versions");
  if (!fs.existsSync(versionsDir)) return undefined;
  try {
    const entries = fs.readdirSync(versionsDir).filter((e) =>
      /^\d+\.\d+/.test(e) && fs.statSync(path.join(versionsDir, e)).isDirectory()
    );
    if (entries.length > 0) return entries[0];
  } catch {}
  return undefined;
}

/** Check libraries/net/minecraft/server/<version>/ for MC version (Forge/NeoForge layout). */
function detectMcVersionFromLibraries(serverRoot: string): string | undefined {
  const minecraftLibDir = path.join(serverRoot, "libraries", "net", "minecraft", "server");
  if (!fs.existsSync(minecraftLibDir)) return undefined;
  try {
    const entries = fs.readdirSync(minecraftLibDir).filter((e) =>
      /^\d+\.\d+/.test(e) && fs.statSync(path.join(minecraftLibDir, e)).isDirectory()
    );
    if (entries.length > 0) return entries[0];
  } catch {}
  return undefined;
}
