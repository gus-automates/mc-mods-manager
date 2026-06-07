"use client";

import { useState, useEffect } from "react";
import { X, Cpu, Lock, Pencil } from "lucide-react";
import { Server } from "@/lib/db";

interface Props {
  existing?: Server;
  onClose: () => void;
  onSave: (data: { name: string; mods_path: string; mc_version: string; loader: string; env: "client" | "server" | "both" }) => Promise<void>;
}

const ENV_LABELS: Record<string, string> = {
  client: "Client only",
  server: "Server only",
  both: "Client + Server",
};

export function ServerModal({ existing, onClose, onSave }: Props) {
  const [name, setName] = useState(existing?.name ?? "");
  const [path, setPath] = useState(existing?.mods_path ?? "");
  const [mcVersion, setMcVersion] = useState(existing?.mc_version ?? "26.1.2");
  const [loader, setLoader] = useState(existing?.loader ?? "fabric");
  const [env, setEnv] = useState<"client" | "server" | "both">(existing?.env ?? "both");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState("");
  const [locked, setLocked] = useState(!existing);
  const [mcVersions, setMcVersions] = useState<string[]>([
    "26.1.2","26.1.1","26.1",
    "1.21.11","1.21.10","1.21.9","1.21.8","1.21.7","1.21.6",
    "1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
    "1.20.6","1.20.4","1.20.2","1.20.1","1.20",
    "1.19.4","1.19.2","1.19",
    "1.18.2","1.18","1.17.1","1.16.5","1.15.2","1.14.4","1.12.2",
  ]);
  const isEditing = !!existing;

  useEffect(() => {
    fetch("/api/mc-versions")
      .then((r) => r.json())
      .then((versions: string[]) => {
        if (versions.length > 0) {
          setMcVersions(versions);
          if (!existing) setMcVersion(versions[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPath(existing.mods_path);
      setMcVersion(existing.mc_version);
      setLoader(existing.loader);
      setEnv(existing.env ?? "both");
      setLocked(false);
    }
  }, [existing]);

  async function handleDetect() {
    if (!path.trim()) return;
    setDetecting(true);
    setDetectMsg("");
    try {
      const res = await fetch(`/api/servers/detect?path=${encodeURIComponent(path.trim())}`);
      const data: { mc_version?: string; loader?: string; env?: "client" | "server" } = await res.json();
      if (!data.mc_version && !data.loader) {
        setDetectMsg("Could not detect — set manually");
        setLocked(false);
      } else {
        if (data.mc_version) setMcVersion(data.mc_version);
        if (data.loader) setLoader(data.loader);
        if (data.env) setEnv(data.env);
        setDetectMsg(`Detected: ${[data.mc_version, data.loader, data.env].filter(Boolean).join(" / ")}`);
        setLocked(true);
      }
    } catch {
      setDetectMsg("Detection failed");
      setLocked(false);
    } finally {
      setDetecting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave({ name, mods_path: path, mc_version: mcVersion, loader, env });
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "8px 11px",
    color: "var(--text-bright)",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.15s",
  };

  const lockedDisplayStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "8px 11px",
    color: "var(--text-muted)",
    fontSize: 13,
    opacity: 0.7,
    userSelect: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 5,
    color: "var(--text-muted)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-light)",
          borderRadius: 5,
          padding: 28,
          width: 500,
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2
            className="font-pixel"
            style={{ color: "var(--text-bright)", fontSize: 11, letterSpacing: "0.05em" }}
          >
            {isEditing ? "Edit Server" : "Add Server"}
          </h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Server Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Survival Server"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Server or Mods Folder Path</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={path}
                onChange={(e) => { setPath(e.target.value); setDetectMsg(""); }}
                placeholder="/home/mc/server  or  /home/mc/server/mods"
                required
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDetect}
                disabled={detecting || !path.trim()}
                style={{ flexShrink: 0, fontSize: 11 }}
                title="Auto-detect MC version and loader from this path"
              >
                <Cpu size={13} />
                {detecting ? "…" : "Detect"}
              </button>
            </div>
            {detectMsg ? (
              <p style={{ fontSize: 11, marginTop: 4, color: detectMsg.startsWith("Detected") ? "var(--accent)" : "var(--text-muted)" }}>
                {detectMsg}
              </p>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                Point to the server root or the mods folder — the app will auto-detect.
              </p>
            )}
          </div>

          {/* Version / Loader / Env row */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Configuration</span>
              {locked ? (
                <button
                  type="button"
                  onClick={() => setLocked(false)}
                  className="btn btn-ghost"
                  style={{ padding: "2px 7px", fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}
                  title="Unlock to edit manually"
                >
                  <Lock size={11} />
                  <Pencil size={11} />
                  Edit
                </button>
              ) : (
                detectMsg.startsWith("Detected") && (
                  <button
                    type="button"
                    onClick={() => setLocked(true)}
                    className="btn btn-ghost"
                    style={{ padding: "2px 7px", fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--accent)" }}
                    title="Lock detected values"
                  >
                    <Lock size={11} />
                    Lock
                  </button>
                )
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Minecraft Version</label>
                {locked ? (
                  <div style={lockedDisplayStyle}>{mcVersion}</div>
                ) : (
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={mcVersion}
                    onChange={(e) => setMcVersion(e.target.value)}
                    required
                  >
                    {mcVersions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>Mod Loader</label>
                {locked ? (
                  <div style={lockedDisplayStyle} title={loader}>{loader.charAt(0).toUpperCase() + loader.slice(1)}</div>
                ) : (
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={loader}
                    onChange={(e) => setLoader(e.target.value)}
                  >
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                    <option value="quilt">Quilt</option>
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>Environment</label>
                {locked ? (
                  <div style={lockedDisplayStyle}>{ENV_LABELS[env]}</div>
                ) : (
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={env}
                    onChange={(e) => setEnv(e.target.value as "client" | "server" | "both")}
                  >
                    <option value="both">Client + Server</option>
                    <option value="client">Client only</option>
                    <option value="server">Server only</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isEditing ? "Saving…" : "Adding…") : (isEditing ? "Save Changes" : "Add Server")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
