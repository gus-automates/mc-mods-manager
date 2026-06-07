"use client";

import { useState, useEffect } from "react";
import { X, Cpu } from "lucide-react";
import { Server } from "@/lib/db";

interface Props {
  existing?: Server;
  onClose: () => void;
  onSave: (data: { name: string; mods_path: string; mc_version: string; loader: string }) => Promise<void>;
}

export function ServerModal({ existing, onClose, onSave }: Props) {
  const [name, setName] = useState(existing?.name ?? "");
  const [path, setPath] = useState(existing?.mods_path ?? "");
  const [mcVersion, setMcVersion] = useState(existing?.mc_version ?? "26.1.2");
  const [loader, setLoader] = useState(existing?.loader ?? "fabric");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState("");
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
    }
  }, [existing]);

  async function handleDetect() {
    if (!path.trim()) return;
    setDetecting(true);
    setDetectMsg("");
    try {
      const res = await fetch(`/api/servers/detect?path=${encodeURIComponent(path.trim())}`);
      const data: { mc_version?: string; loader?: string } = await res.json();
      if (!data.mc_version && !data.loader) {
        setDetectMsg("Could not detect — set manually");
      } else {
        if (data.mc_version) setMcVersion(data.mc_version);
        if (data.loader) setLoader(data.loader);
        setDetectMsg(`Detected: ${[data.mc_version, data.loader].filter(Boolean).join(" / ")}`);
      }
    } catch {
      setDetectMsg("Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave({ name, mods_path: path, mc_version: mcVersion, loader });
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Minecraft Version</label>
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
            </div>
            <div>
              <label style={labelStyle}>Mod Loader</label>
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
