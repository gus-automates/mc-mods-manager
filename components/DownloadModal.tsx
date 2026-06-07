"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Download, ExternalLink, ChevronDown } from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Root } from "hast";

const KNOWN_HTML_TAGS = new Set([
  "a","abbr","address","area","article","aside","audio","b","base","bdi","bdo","blockquote","body","br","button","canvas","caption","cite","code","col","colgroup","data","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","iframe","img","input","ins","kbd","label","legend","li","link","main","map","mark","menu","meta","meter","nav","noscript","object","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr",
]);

function rehypeNormalizeUnknownTags() {
  return (tree: Root) => {
    const visit = (node: unknown) => {
      const n = node as { type?: string; tagName?: string; children?: unknown[] };
      if (n.type === "element" && n.tagName && !KNOWN_HTML_TAGS.has(n.tagName)) {
        n.tagName = "span";
      }
      if (n.children) n.children.forEach(visit);
    };
    visit(tree);
  };
}

interface SearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  categories: string[];
  latest_version: string;
}

interface ModVersion {
  id: string;
  name: string;
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  loaders: string[];
  game_versions: string[];
  files: { url: string; filename: string; primary: boolean; size: number }[];
}

interface ModDetail {
  slug: string;
  title: string;
  description: string;
  body: string;
  icon_url: string | null;
  downloads: number;
  categories: string[];
  source_url?: string;
  issues_url?: string;
  wiki_url?: string;
}

interface Props {
  serverId: string;
  loader: string;
  mcVersion: string;
  env: "client" | "server" | "both";
  onClose: () => void;
  onDownloaded: () => void;
}

function formatDownloads(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function formatBytes(n: number) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(n / 1024) + " KB";
}

export function DownloadModal({ serverId, loader, mcVersion, env, onClose, onDownloaded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [detail, setDetail] = useState<ModDetail | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [chosenVersionId, setChosenVersionId] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
    handleSearch(undefined, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e?: React.FormEvent, overrideQuery?: string) {
    e?.preventDefault();
    const q = overrideQuery !== undefined ? overrideQuery : query;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(
        `/api/modrinth/search?q=${encodeURIComponent(q)}&loader=${loader}&version=${mcVersion}&env=${env}`
      );
      const data = await res.json();
      const hits: SearchHit[] = data.hits ?? [];
      setResults(hits);
      if (hits.length > 0 && !selected) selectMod(hits[0]);
    } catch {
      setError("Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  }

  async function selectMod(hit: SearchHit) {
    setSelected(hit);
    setDetail(null);
    setVersions([]);
    setChosenVersionId("");
    setLoadingDetail(true);
    try {
      const [detailRes, versionsRes] = await Promise.all([
        fetch(`/api/modrinth/project/${hit.slug}`),
        fetch(`/api/modrinth/project/${hit.slug}/versions?loader=${loader}&version=${mcVersion}`),
      ]);
      if (detailRes.ok) setDetail(await detailRes.json());
      if (versionsRes.ok) {
        const v: ModVersion[] = await versionsRes.json();
        setVersions(v);
        if (v.length > 0) {
          const best =
            v.find((ver) => ver.loaders.includes(loader) && ver.game_versions.includes(mcVersion)) ??
            v.find((ver) => ver.loaders.includes(loader) && ver.version_type === "release") ??
            v.find((ver) => ver.loaders.includes(loader)) ??
            v[0];
          setChosenVersionId(best.id);
        }
      } else {
        const body = await versionsRes.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to load versions.");
      }
    } catch {
      setError("Failed to load mod versions. Check your connection.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDownload() {
    if (!selected) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("/api/modrinth/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: serverId,
          project_slug: selected.slug,
          version_id: chosenVersionId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDownloaded();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const versionTypeColor = (t: string) =>
    t === "release" ? "var(--accent)" : t === "beta" ? "var(--yellow)" : "var(--text-muted)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-light)",
          borderRadius: 5,
          width: "min(900px, 92vw)",
          height: "min(640px, 88vh)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          <h2
            className="font-pixel"
            style={{ color: "var(--text-bright)", fontSize: 10, letterSpacing: "0.05em" }}
          >
            Download Mod
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
              {loader} · {mcVersion}
            </span>
            {env !== "both" && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 3,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "var(--blue-dim)",
                color: "var(--blue)",
                border: "1px solid rgba(96,165,250,0.2)",
              }}>
                {env === "server" ? "Server-side only" : "Client-side only"}
              </span>
            )}
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body: left list + right detail */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT: search + results */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Search bar */}
            <form
              onSubmit={handleSearch}
              style={{
                padding: "10px 10px 8px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                gap: 6,
              }}
            >
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Modrinth…"
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  padding: "6px 10px",
                  color: "var(--text-bright)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "6px 10px", flexShrink: 0 }}
                disabled={searching}
              >
                <Search size={12} />
              </button>
            </form>

            {/* Results list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {error && (
                <p style={{ color: "var(--red)", padding: "12px 12px 0", fontSize: 12 }}>{error}</p>
              )}
              {searching && (
                <p style={{ color: "var(--text-muted)", padding: 12, fontSize: 12 }}>Searching…</p>
              )}
              {!searching &&
                results.map((hit) => {
                  const isSelected = selected?.project_id === hit.project_id;
                  return (
                    <div
                      key={hit.project_id}
                      onClick={() => selectMod(hit)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "9px 11px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border)",
                        background: isSelected ? "var(--surface-3)" : "transparent",
                        borderLeft: isSelected
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      }}
                    >
                      {hit.icon_url ? (
                        <Image
                          src={hit.icon_url}
                          alt={hit.title}
                          width={32}
                          height={32}
                          style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                          unoptimized
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            background: "var(--surface-3)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: isSelected ? "var(--text-bright)" : "var(--text)",
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {hit.title}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                          {formatDownloads(hit.downloads)} downloads
                        </div>
                      </div>
                    </div>
                  );
                })}
              {!searching && results.length === 0 && (
                <p style={{ color: "var(--text-muted)", padding: 16, fontSize: 12, textAlign: "center" }}>
                  No results
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: detail panel */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {!selected ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                Select a mod to see details
              </div>
            ) : (
              <>
                {/* Mod header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    flexShrink: 0,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {selected.icon_url ? (
                      <Image
                        src={selected.icon_url}
                        alt={selected.title}
                        width={48}
                        height={48}
                        style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                        unoptimized
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          background: "var(--surface-3)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontWeight: 700, color: "var(--text-bright)", fontSize: 15 }}
                      >
                        {selected.title}
                      </div>
                      <div
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 12,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {selected.description}
                      </div>
                    </div>

                    <a
                      href={`https://modrinth.com/mod/${selected.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ flexShrink: 0, fontSize: 11 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} />
                      Modrinth
                    </a>
                  </div>
                </div>

                {/* Description body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  {loadingDetail ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
                  ) : detail?.body ? (
                    <div className="md-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeNormalizeUnknownTags]}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer"
                              style={{ color: "var(--blue)", textDecoration: "underline", textDecorationColor: "rgba(96,165,250,0.4)" }}>
                              {children}
                            </a>
                          ),
                          img: ({ src, alt }) => (
                            src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt={alt ?? ""} style={{ maxWidth: "100%", borderRadius: 4, margin: "6px 0" }} />
                            ) : null
                          ),
                          h1: ({ children }) => <h1 style={{ color: "var(--text-bright)", fontWeight: 700, fontSize: 14, margin: "14px 0 6px" }}>{children}</h1>,
                          h2: ({ children }) => <h2 style={{ color: "var(--text-bright)", fontWeight: 700, fontSize: 13, margin: "12px 0 5px" }}>{children}</h2>,
                          h3: ({ children }) => <h3 style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: 12, margin: "10px 0 4px" }}>{children}</h3>,
                          p: ({ children }) => <p style={{ marginBottom: 8, lineHeight: 1.6 }}>{children}</p>,
                          ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBottom: 8, lineHeight: 1.6 }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBottom: 8, lineHeight: 1.6 }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                          code: ({ children, className }) => className ? (
                            <code style={{ display: "block", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3, padding: "8px 10px", fontSize: 11, fontFamily: "monospace", margin: "6px 0", overflowX: "auto", whiteSpace: "pre" }}>{children}</code>
                          ) : (
                            <code style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 2, padding: "1px 5px", fontSize: 11, fontFamily: "monospace" }}>{children}</code>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote style={{ borderLeft: "3px solid var(--border-light)", paddingLeft: 12, margin: "8px 0", color: "var(--text-muted)" }}>{children}</blockquote>
                          ),
                          hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />,
                          strong: ({ children }) => <strong style={{ color: "var(--text-bright)", fontWeight: 600 }}>{children}</strong>,
                        }}
                      >
                        {detail.body}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No description available.</p>
                  )}
                </div>

                {/* Bottom: version selector + install */}
                <div
                  style={{
                    padding: "12px 20px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  {versions.length > 0 && (
                    <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
                      <select
                        value={chosenVersionId}
                        onChange={(e) => setChosenVersionId(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: 3,
                          padding: "7px 32px 7px 10px",
                          color: "var(--text-bright)",
                          fontSize: 12,
                          outline: "none",
                          appearance: "none",
                          cursor: "pointer",
                        }}
                      >
                        {[...versions].sort((a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime()).map((v) => {
                          const isBest = v.loaders.includes(loader) && v.game_versions.includes(mcVersion);
                          const mcLabel = v.game_versions.length <= 2
                            ? v.game_versions.join(", ")
                            : `${v.game_versions.slice(0, 2).join(", ")} +${v.game_versions.length - 2}`;
                          const loaderLabel = v.loaders.join(", ");
                          const sizeLabel = v.files[0] ? ` · ${formatBytes(v.files[0].size)}` : "";
                          return (
                            <option key={v.id} value={v.id}>
                              {isBest ? "★ " : ""}{v.version_number} [{v.version_type}] · MC {mcLabel} · {loaderLabel}{sizeLabel}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown
                        size={13}
                        style={{
                          position: "absolute",
                          right: 9,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  )}

                  {/* Version type badge */}
                  {chosenVersionId && versions.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 3,
                        color: versionTypeColor(
                          versions.find((v) => v.id === chosenVersionId)?.version_type ?? ""
                        ),
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      {versions.find((v) => v.id === chosenVersionId)?.version_type ?? ""}
                    </span>
                  )}

                  {error && (
                    <p style={{ color: "var(--red)", fontSize: 11, flex: 1 }}>{error}</p>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={handleDownload}
                    disabled={downloading || versions.length === 0}
                    style={{ flexShrink: 0, marginLeft: "auto" }}
                  >
                    <Download size={13} />
                    {downloading ? "Installing…" : "Install Mod"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
