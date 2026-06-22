"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mod, MissingDep, Server } from "@/lib/db";
import { ModTable } from "@/components/ModTable";
import { DownloadModal } from "@/components/DownloadModal";
import { ServerModal } from "@/components/ServerModal";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Pencil,
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
  const [showEdit, setShowEdit] = useState(false);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [fixingDeps, setFixingDeps] = useState<Set<string>>(new Set());
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
      const data = await res.json();
      setMods(data.mods);
      const versionChanged = data.server && data.server.mc_version !== server?.mc_version;
      if (data.server) setServer(data.server);
      showToast("Mods scanned successfully");
      if (versionChanged) await handleCheckUpdates();
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
        body: JSON.stringify({
          server_id: serverId,
          project_slug: mod.modrinth_slug,
          replace_filename: mod.filename,
        }),
      });
      if (!dlRes.ok) throw new Error((await dlRes.json()).error);
      await handleScan();
      showToast(`${mod.name} updated`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Update failed", "err");
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(modId); return s; });
    }
  }

  async function handleBulkUpdate(modIds: string[]) {
    const targets = mods.filter(
      (m) => modIds.includes(m.id) && m.update_available && m.modrinth_slug
    );
    if (targets.length === 0) {
      showToast("No updatable mods selected", "err");
      return;
    }
    setUpdating((prev) => {
      const s = new Set(prev);
      targets.forEach((m) => s.add(m.id));
      return s;
    });
    let ok = 0;
    let failed = 0;
    try {
      await Promise.all(
        targets.map(async (mod) => {
          try {
            const dlRes = await fetch("/api/modrinth/download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                server_id: serverId,
                project_slug: mod.modrinth_slug,
                replace_filename: mod.filename,
              }),
            });
            if (!dlRes.ok) throw new Error((await dlRes.json()).error);
            ok++;
          } catch {
            failed++;
          }
        })
      );
      await handleScan();
      showToast(
        failed > 0
          ? `Updated ${ok} mod${ok !== 1 ? "s" : ""}, ${failed} failed`
          : `Updated ${ok} mod${ok !== 1 ? "s" : ""}`,
        failed > 0 ? "err" : "ok"
      );
    } finally {
      setUpdating((prev) => {
        const s = new Set(prev);
        targets.forEach((m) => s.delete(m.id));
        return s;
      });
    }
  }

  async function handleFixDeps(modId: string, deps: MissingDep[]) {
    setFixingDeps((prev) => new Set(prev).add(modId));
    try {
      await Promise.all(
        deps.map((dep) =>
          fetch("/api/modrinth/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ server_id: serverId, project_slug: dep.slug }),
          })
        )
      );
      await handleScan();
      showToast(`Installed ${deps.length} missing dep${deps.length !== 1 ? "s" : ""}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to install deps", "err");
    } finally {
      setFixingDeps((prev) => { const s = new Set(prev); s.delete(modId); return s; });
    }
  }

  async function handleEditServer(data: { name: string; mods_path: string; mc_version: string; loader: string; env: "client" | "server" | "both" }) {
    const res = await fetch(`/api/servers/${serverId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      const versionChanged = updated.mc_version !== server?.mc_version;
      setServer(updated);
      setShowEdit(false);
      if (versionChanged) await handleCheckUpdates();
      return;
    }
    setShowEdit(false);
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

          <span
            style={{
              background: "var(--surface-3)",
              color: "var(--text-muted)",
              padding: "2px 7px",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "capitalize",
              border: "1px solid var(--border)",
            }}
          >
            {server?.env === "client" ? "client" : server?.env === "server" ? "server" : "client+server"}
          </span>

          <button
            className="btn btn-ghost"
            onClick={() => setShowEdit(true)}
            style={{ padding: "3px 6px", marginLeft: 2 }}
            title="Edit server"
          >
            <Pencil size={13} />
          </button>
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
          onBulkUpdate={handleBulkUpdate}
          onFixDeps={handleFixDeps}
          updating={updating}
          fixingDeps={fixingDeps}
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
          env={server.env ?? "both"}
          onClose={() => setShowDownload(false)}
          onDownloaded={handleScan}
        />
      )}

      {showEdit && server && (
        <ServerModal
          existing={server}
          onClose={() => setShowEdit(false)}
          onSave={handleEditServer}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
