"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mod, Server } from "@/lib/db";
import { ModTable } from "@/components/ModTable";
import { DownloadModal } from "@/components/DownloadModal";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function ServerPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;

  const [server, setServer] = useState<Server | null>(null);
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchMods = useCallback(async () => {
    const res = await fetch(`/api/servers/${serverId}/mods`);
    if (res.ok) setMods(await res.json());
  }, [serverId]);

  useEffect(() => {
    async function load() {
      const sRes = await fetch(`/api/servers/${serverId}`);
      if (!sRes.ok) { router.push("/"); return; }
      setServer(await sRes.json());
      setLoading(false);
      await fetchMods();
    }
    load();
  }, [serverId, router, fetchMods]);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/mods/scan`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      setMods(await res.json());
      showToast("Mods scanned successfully");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Scan failed", "err");
    } finally {
      setScanning(false);
    }
  }

  async function handleCheckUpdates() {
    setCheckingUpdates(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/mods/updates`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setMods(data.mods);
      showToast(
        data.updated > 0
          ? `${data.updated} update${data.updated !== 1 ? "s" : ""} available`
          : "All mods up to date"
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Update check failed", "err");
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function handleToggle(modIds: string[]) {
    await Promise.all(
      modIds.map((id) => fetch(`/api/mods/${id}/toggle`, { method: "POST" }))
    );
    await fetchMods();
  }

  async function handleDelete(modIds: string[]) {
    const names = mods.filter((m) => modIds.includes(m.id)).map((m) => m.name);
    const label = modIds.length === 1 ? `"${names[0]}"` : `${modIds.length} mods`;
    if (!confirm(`Delete ${label}? The file${modIds.length > 1 ? "s" : ""} will be removed from disk.`)) return;
    await Promise.all(modIds.map((id) => fetch(`/api/mods/${id}`, { method: "DELETE" })));
    setMods((prev) => prev.filter((m) => !modIds.includes(m.id)));
    showToast(`${label} removed`);
  }

  async function handleUpdate(modId: string) {
    const mod = mods.find((m) => m.id === modId);
    if (!mod?.modrinth_slug) return;
    setUpdating((prev) => new Set(prev).add(modId));
    try {
      const dlRes = await fetch("/api/modrinth/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server_id: serverId, project_slug: mod.modrinth_slug }),
      });
      if (!dlRes.ok) throw new Error((await dlRes.json()).error);
      await fetch(`/api/mods/${modId}`, { method: "DELETE" });
      await handleScan();
      showToast(`${mod.name} updated`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Update failed", "err");
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(modId); return s; });
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text-muted)",
          gap: 10,
        }}
      >
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12 }}>Loading server…</span>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const enabledCount = mods.filter((m) => m.enabled).length;
  const updateCount = mods.filter((m) => m.update_available).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0 28px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="btn btn-ghost"
            onClick={() => router.push("/")}
            style={{ padding: "4px 8px", fontSize: 12 }}
          >
            <ArrowLeft size={14} />
            Servers
          </button>

          <span style={{ color: "var(--border)", fontSize: 18, lineHeight: 1 }}>›</span>

          <span style={{ color: "var(--text-bright)", fontWeight: 700, fontSize: 14 }}>
            {server?.name}
          </span>

          <span
            style={{
              background: "var(--blue-dim)",
              color: "var(--blue)",
              padding: "2px 7px",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid rgba(96,165,250,0.2)",
            }}
          >
            {server?.mc_version}
          </span>

          <span
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              padding: "2px 7px",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "capitalize",
              border: "1px solid rgba(74,222,128,0.2)",
            }}
          >
            {server?.loader}
          </span>
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          <button
            className="btn btn-secondary"
            onClick={handleScan}
            disabled={scanning}
            style={{ fontSize: 12 }}
          >
            <RefreshCw
              size={12}
              style={scanning ? { animation: "spin 1s linear infinite" } : {}}
            />
            {scanning ? "Scanning…" : "Scan"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
            style={{ fontSize: 12 }}
          >
            <CheckCircle size={12} />
            {checkingUpdates ? "Checking…" : "Check Updates"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowDownload(true)}
            style={{ fontSize: 12 }}
          >
            <Download size={12} />
            Download Mod
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div
        style={{
          padding: "8px 28px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          gap: 20,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <span>
          <strong style={{ color: "var(--text-bright)" }}>{mods.length}</strong> installed
        </span>
        <span>
          <strong style={{ color: "var(--accent)" }}>{enabledCount}</strong> enabled
        </span>
        <span>
          <strong style={{ color: "var(--text-muted)" }}>{mods.length - enabledCount}</strong> disabled
        </span>
        {updateCount > 0 && (
          <span>
            <strong style={{ color: "var(--yellow)" }}>{updateCount}</strong> update
            {updateCount !== 1 ? "s" : ""} available
          </span>
        )}
      </div>

      {/* Content */}
      <main style={{ padding: "20px 28px" }}>
        <ModTable
          mods={mods}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          updating={updating}
        />
      </main>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "var(--surface-2)",
            border: `1px solid ${toast.type === "ok" ? "var(--border-light)" : "rgba(248,113,113,0.3)"}`,
            borderRadius: 4,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: toast.type === "ok" ? "var(--text-bright)" : "var(--red)",
            fontSize: 12,
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {toast.type === "ok" ? (
            <CheckCircle size={13} color="var(--accent)" />
          ) : (
            <AlertCircle size={13} />
          )}
          {toast.msg}
        </div>
      )}

      {showDownload && server && (
        <DownloadModal
          serverId={serverId}
          loader={server.loader}
          mcVersion={server.mc_version}
          onClose={() => setShowDownload(false)}
          onDownloaded={handleScan}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
