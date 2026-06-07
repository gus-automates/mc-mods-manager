import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const MODS_FILE = path.join(DATA_DIR, "mods.json");

export interface Server {
  id: string;
  name: string;
  /** Path to the mods folder (resolved at creation time) */
  mods_path: string;
  mc_version: string;
  loader: string;
  env: "client" | "server" | "both";
}

export interface MissingDep {
  project_id: string;
  title: string;
  slug: string;
}

export interface Mod {
  id: string;
  server_id: string;
  filename: string;
  modrinth_id: string | null;
  modrinth_slug: string | null;
  name: string;
  version: string | null;
  icon_url: string | null;
  enabled: boolean;
  last_modified: string;
  provider: string;
  sha512: string | null;
  update_available: boolean;
  latest_version: string | null;
  homepage_url: string | null;
  missing_deps?: MissingDep[];
}

/** Given a path (server root OR mods folder), resolve the mods directory. */
export function resolveModsPath(inputPath: string): string {
  const normalized = inputPath.trim();
  // If it already ends with "mods" and is a directory, use it directly
  if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
    const base = path.basename(normalized).toLowerCase();
    if (base === "mods") return normalized;
    // Check for a mods sub-directory
    const sub = path.join(normalized, "mods");
    if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) return sub;
  }
  // Fall back to as-given (might not exist yet on this machine)
  return normalized;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readServers(): Server[] {
  ensureDataDir();
  if (!fs.existsSync(SERVERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SERVERS_FILE, "utf-8"));
}

function writeServers(servers: Server[]) {
  ensureDataDir();
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

function readMods(): Mod[] {
  ensureDataDir();
  if (!fs.existsSync(MODS_FILE)) return [];
  return JSON.parse(fs.readFileSync(MODS_FILE, "utf-8"));
}

function writeMods(mods: Mod[]) {
  ensureDataDir();
  fs.writeFileSync(MODS_FILE, JSON.stringify(mods, null, 2));
}

export const db = {
  getServers: (): Server[] => readServers(),

  getServer: (id: string): Server | undefined =>
    readServers().find((s) => s.id === id),

  createServer: (data: Omit<Server, "id">): Server => {
    const servers = readServers();
    const server: Server = { id: crypto.randomUUID(), ...data };
    writeServers([...servers, server]);
    return server;
  },

  updateServer: (id: string, patch: Partial<Omit<Server, "id">>): Server | undefined => {
    const servers = readServers();
    const idx = servers.findIndex((s) => s.id === id);
    if (idx < 0) return undefined;
    servers[idx] = { ...servers[idx], ...patch };
    writeServers(servers);
    return servers[idx];
  },

  deleteServer: (id: string) => {
    writeServers(readServers().filter((s) => s.id !== id));
    writeMods(readMods().filter((m) => m.server_id !== id));
  },

  getModsByServer: (serverId: string): Mod[] =>
    readMods().filter((m) => m.server_id === serverId),

  getMod: (id: string): Mod | undefined => readMods().find((m) => m.id === id),

  upsertMod: (mod: Mod) => {
    const mods = readMods();
    const idx = mods.findIndex((m) => m.id === mod.id);
    if (idx >= 0) mods[idx] = mod;
    else mods.push(mod);
    writeMods(mods);
  },

  upsertMods: (newMods: Mod[]) => {
    const existing = readMods();
    for (const mod of newMods) {
      const idx = existing.findIndex((m) => m.id === mod.id);
      if (idx >= 0) existing[idx] = mod;
      else existing.push(mod);
    }
    writeMods(existing);
  },

  deleteModsNotIn: (serverId: string, keepIds: string[]) => {
    const mods = readMods().filter(
      (m) => m.server_id !== serverId || keepIds.includes(m.id)
    );
    writeMods(mods);
  },

  deleteMod: (id: string) => {
    writeMods(readMods().filter((m) => m.id !== id));
  },

  updateModField: <K extends keyof Mod>(id: string, field: K, value: Mod[K]) => {
    const mods = readMods();
    const idx = mods.findIndex((m) => m.id === id);
    if (idx >= 0) {
      mods[idx][field] = value;
      writeMods(mods);
    }
  },
};
