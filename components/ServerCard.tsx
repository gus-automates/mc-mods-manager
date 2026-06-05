"use client";

import { useState } from "react";
import { Server } from "@/lib/db";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Package, FolderOpen } from "lucide-react";

interface Props {
  server: Server & { mod_count: number };
  onDelete: (id: string) => void;
  onEdit: (server: Server & { mod_count: number }) => void;
}

export function ServerCard({ server, onDelete, onEdit }: Props) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => router.push(`/servers/${server.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 4,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s",
        position: "relative",
        boxShadow: hovered
          ? "0 0 0 1px rgba(74,222,128,0.1), 0 4px 16px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Hover action buttons */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          display: "flex",
          gap: 4,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s",
          pointerEvents: hovered ? "auto" : "none",
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={(e) => { e.stopPropagation(); onEdit(server); }}
          style={{ padding: "4px 6px", borderRadius: 3 }}
          title="Edit server"
        >
          <Pencil size={13} color="var(--text-muted)" />
        </button>
        <button
          className="btn btn-ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(server.id); }}
          style={{ padding: "4px 6px", borderRadius: 3 }}
          title="Remove server"
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--red)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "")}
        >
          <Trash2 size={13} color="var(--red)" />
        </button>
      </div>

      {/* Server name */}
      <div
        style={{
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-bright)",
          marginBottom: 10,
          paddingRight: 56,
          letterSpacing: "0.01em",
        }}
      >
        {server.name}
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span
          style={{
            background: "var(--blue-dim)",
            color: "var(--blue)",
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid rgba(96,165,250,0.2)",
          }}
        >
          {server.mc_version}
        </span>
        <span
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "capitalize",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          {server.loader}
        </span>
      </div>

      {/* Mod count */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12 }}>
        <Package size={12} />
        <span>{server.mod_count} mod{server.mod_count !== 1 ? "s" : ""} installed</span>
      </div>

      {/* Path */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginTop: 5,
          color: "var(--text-muted)",
          fontSize: 11,
        }}
      >
        <FolderOpen size={11} style={{ flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}
        >
          {server.mods_path}
        </span>
      </div>
    </div>
  );
}
