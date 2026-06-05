const BASE = "https://api.modrinth.com/v2";
const HEADERS = {
  "User-Agent": "McModsManager/1.0 (github.com/gus-automates/mc-mods-manager)",
  "Content-Type": "application/json",
};

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  icon_url: string | null;
  project_type: string;
  downloads: number;
  versions: string[];
  source_url?: string;
  issues_url?: string;
  wiki_url?: string;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  loaders: string[];
  game_versions: string[];
  date_published: string;
  files: {
    hashes: { sha512: string; sha1: string };
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

export interface ModrinthSearchResult {
  hits: {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    icon_url: string | null;
    downloads: number;
    versions: string[];
    categories: string[];
    latest_version: string;
  }[];
  total_hits: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Modrinth ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Modrinth POST ${path}: ${res.status}`);
  return res.json();
}

export const modrinth = {
  search: (query: string, loader: string, gameVersion: string, limit = 20) =>
    get<ModrinthSearchResult>(
      `/search?query=${encodeURIComponent(query)}&limit=${limit}&facets=${encodeURIComponent(
        JSON.stringify([
          ["project_type:mod"],
          [`categories:${loader}`],
          [`versions:${gameVersion}`],
        ])
      )}`
    ),

  getProject: (slugOrId: string) =>
    get<ModrinthProject>(`/project/${slugOrId}`),

  getVersions: (slugOrId: string, loader: string, gameVersion: string) =>
    get<ModrinthVersion[]>(
      `/project/${slugOrId}/versions?loaders=${encodeURIComponent(
        JSON.stringify([loader])
      )}&game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}`
    ),

  getAllVersions: (slugOrId: string) =>
    get<ModrinthVersion[]>(`/project/${slugOrId}/versions`),

  // Resolve mod metadata from a batch of SHA512 hashes
  resolveHashes: (hashes: string[]) =>
    post<Record<string, ModrinthVersion>>("/version_files", {
      hashes,
      algorithm: "sha512",
    }),

  // Check for updates: returns map of hash → latest version
  checkUpdates: (
    hashes: string[],
    loaders: string[],
    gameVersions: string[]
  ) =>
    post<Record<string, ModrinthVersion>>("/version_files/update", {
      hashes,
      algorithm: "sha512",
      loaders,
      game_versions: gameVersions,
    }),
};
