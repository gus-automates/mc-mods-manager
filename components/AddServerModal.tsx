"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onAdd: (server: { name: string; mods_path: string; mc_version: string; loader: string }) => void;
}

export function AddServerModal({ onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [modsPath, setModsPath] = useState("");
  const [mcVersion, setMcVersion] = useState("26.1.2");
  const [loader, setLoader] = useState("fabric");
  const [loading, setLoading] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([
    "26.1.2","26.1.1","26.1",
    "1.21.11","1.21.10","1.21.9","1.21.8","1.21.7","1.21.6",
    "1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
    "1.20.6","1.20.4","1.20.2","1.20.1","1.20",
    "1.19.4","1.19.2","1.19",
    "1.18.2","1.18","1.17.1","1.16.5","1.15.2","1.14.4","1.12.2",
  ]);

  useEffect(() => {
    fetch("/api/mc-versions")
      .then((r) => r.json())
      .then((versions: string[]) => {
        if (versions.length > 0) {
          setMcVersions(versions);
          setMcVersion(versions[0]);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onAdd({ name, mods_path: modsPath, mc_version: mcVersion, loader });
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 12px",
    color: "var(--text-bright)",
    fontSize: 14,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
          width: 480,
          maxWidth: "90vw",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2 style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: 18 }}>
            Add Server
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
            <label style={labelStyle}>Mods Folder Path</label>
            <input
              style={inputStyle}
              value={modsPath}
              onChange={(e) => setModsPath(e.target.value)}
              placeholder="/home/mc/server/mods"
              required
            />
            <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
              Full path to the mods directory on your server
            </p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Minecraft Version</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
              >
                {mcVersions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
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

          <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "8px 18px",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "var(--accent)",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                color: "#fff",
                cursor: loading ? "wait" : "pointer",
                fontSize: 14,
                fontWeight: 500,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Adding…" : "Add Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
