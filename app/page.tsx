"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Server } from "@/lib/db";
import { ServerCard } from "@/components/ServerCard";
import { ServerModal } from "@/components/ServerModal";

interface ServerWithCount extends Server {
  mod_count: number;
}

export default function Dashboard() {
  const [servers, setServers] = useState<ServerWithCount[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ServerWithCount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchServers(); }, []);

  async function fetchServers() {
    setLoading(true);
    const res = await fetch("/api/servers");
    setServers(await res.json());
    setLoading(false);
  }

  async function handleAdd(data: { name: string; mods_path: string; mc_version: string; loader: string; env: "client" | "server" | "both" }) {
    await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAdd(false);
    fetchServers();
  }

  async function handleEdit(data: { name: string; mods_path: string; mc_version: string; loader: string; env: "client" | "server" | "both" }) {
    if (!editing) return;
    await fetch(`/api/servers/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditing(null);
    fetchServers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this server? Mod files won't be deleted.")) return;
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    fetchServers();
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0 32px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="font-pixel"
          style={{ color: "var(--accent)", fontSize: 10, letterSpacing: "0.05em" }}
        >
          MC Mods Manager
        </span>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={13} />
          Add Server
        </button>
      </header>

      {/* Main */}
      <main style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-bright)", marginBottom: 4 }}>
            Servers
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {servers.length} server{servers.length !== 1 ? "s" : ""} registered
          </p>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
        ) : servers.length === 0 ? (
          <div
            style={{
              border: "2px dashed var(--border)",
              borderRadius: 5,
              padding: "64px 0",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <p
              className="font-pixel"
              style={{ fontSize: 9, marginBottom: 16, color: "var(--text-muted)", letterSpacing: "0.05em" }}
            >
              No servers yet
            </p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={13} />
              Add your first server
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: 14,
            }}
          >
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onDelete={handleDelete}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <ServerModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editing && (
        <ServerModal existing={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
      )}
    </div>
  );
}
