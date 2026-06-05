"use client";

import { useState, useCallback } from "react";
import { Mod } from "@/lib/db";
import Image from "next/image";
import {
  Trash2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  ArrowUpCircle,
  RefreshCw,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";

interface Props {
  mods: Mod[];
  onToggle: (modIds: string[]) => void;
  onDelete: (modIds: string[]) => void;
  onUpdate: (modId: string) => void;
  updating: Set<string>;
}

type SortCol = "name" | "version" | "last_modified" | "provider" | "enabled";
type SortDir = "asc" | "desc";

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

export function ModTable({ mods, onToggle, onDelete, onUpdate, updating }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSortClick(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtered = mods
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "version") cmp = (a.version ?? "").localeCompare(b.version ?? "");
      else if (sortCol === "last_modified") cmp = a.last_modified.localeCompare(b.last_modified);
      else if (sortCol === "provider") cmp = a.provider.localeCompare(b.provider);
      else if (sortCol === "enabled") cmp = Number(b.enabled) - Number(a.enabled);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((m) => m.id)));
  }

  // Checkbox column click: always toggle individual (no clear)
  function handleCheckboxClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastClicked(id);
  }

  // Row body click: single-select unless Ctrl/Shift
  const handleRowClick = useCallback(
    (e: React.MouseEvent, mod: Mod) => {
      const id = mod.id;
      if (e.ctrlKey || e.metaKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        setLastClicked(id);
      } else if (e.shiftKey && lastClicked) {
        const ids = filtered.map((m) => m.id);
        const a = ids.indexOf(lastClicked);
        const b = ids.indexOf(id);
        const [start, end] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = new Set(prev);
          ids.slice(start, end + 1).forEach((rid) => next.add(rid));
          return next;
        });
      } else {
        // plain click on row: single-select (toggle off if only this one)
        setSelected((prev) => {
          if (prev.size === 1 && prev.has(id)) return new Set();
          return new Set([id]);
        });
        setLastClicked(id);
      }
    },
    [filtered, lastClicked]
  );

  const selectedMods = mods.filter((m) => selected.has(m.id));
  const selectionCount = selected.size;

  function bulkEnable() {
    const ids = selectedMods.filter((m) => !m.enabled).map((m) => m.id);
    if (ids.length) onToggle(ids);
  }
  function bulkDisable() {
    const ids = selectedMods.filter((m) => m.enabled).map((m) => m.id);
    if (ids.length) onToggle(ids);
  }
  function bulkDelete() {
    onDelete([...selected]);
    setSelected(new Set());
  }

  const colGrid = "34px 40px 1fr 120px 155px 80px 72px";

  const headerCellStyle = (col: SortCol): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    userSelect: "none",
    color: sortCol === col ? "var(--accent)" : "var(--text-muted)",
    transition: "color 0.1s",
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter mods…"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "6px 11px",
            color: "var(--text-bright)",
            fontSize: 12,
            outline: "none",
            width: 200,
          }}
        />

        {selectionCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 8px",
            background: "var(--surface-3)", border: "1px solid var(--border-light)", borderRadius: 3,
          }}>
            <span style={{ color: "var(--accent)", fontSize: 11, fontWeight: 700 }}>
              {selectionCount} selected
            </span>
            <div style={{ width: 1, height: 14, background: "var(--border)" }} />
            <button className="btn btn-ghost" onClick={bulkEnable} style={{ padding: "2px 7px", fontSize: 11 }} title="Enable selected">
              <ToggleRight size={13} color="var(--accent)" /> Enable
            </button>
            <button className="btn btn-ghost" onClick={bulkDisable} style={{ padding: "2px 7px", fontSize: 11 }} title="Disable selected">
              <ToggleLeft size={13} /> Disable
            </button>
            <button className="btn btn-ghost" onClick={bulkDelete} style={{ padding: "2px 7px", fontSize: 11 }} title="Delete selected">
              <Trash2 size={13} color="var(--red)" />
              <span style={{ color: "var(--red)" }}>Delete</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setSelected(new Set())} style={{ padding: "2px 5px", fontSize: 11, color: "var(--text-muted)" }}>✕</button>
          </div>
        )}

        <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>
          {filtered.length} mod{filtered.length !== 1 ? "s" : ""}
          {selectionCount === 0 && <span style={{ marginLeft: 6, opacity: 0.5 }}>· Ctrl/Shift+click to multi-select</span>}
        </span>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: colGrid,
          padding: "7px 12px", background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
          alignItems: "center",
        }}>
          {/* Select-all checkbox */}
          <button onClick={toggleAll} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", padding: 0 }}>
            {allSelected ? <CheckSquare size={14} color="var(--accent)" /> : <Square size={14} />}
          </button>

          <span />

          <span style={headerCellStyle("name")} onClick={() => handleSortClick("name")}>
            Name <SortIcon col="name" active={sortCol === "name"} dir={sortDir} />
          </span>

          <span style={headerCellStyle("version")} onClick={() => handleSortClick("version")}>
            Version <SortIcon col="version" active={sortCol === "version"} dir={sortDir} />
          </span>

          <span style={headerCellStyle("last_modified")} onClick={() => handleSortClick("last_modified")}>
            Last Modified <SortIcon col="last_modified" active={sortCol === "last_modified"} dir={sortDir} />
          </span>

          <span style={headerCellStyle("provider")} onClick={() => handleSortClick("provider")}>
            Provider <SortIcon col="provider" active={sortCol === "provider"} dir={sortDir} />
          </span>

          <span style={{ ...headerCellStyle("enabled"), justifyContent: "flex-end" }} onClick={() => handleSortClick("enabled")}>
            <SortIcon col="enabled" active={sortCol === "enabled"} dir={sortDir} /> Status
          </span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", background: "var(--surface)", fontSize: 12 }}>
            {search ? "No mods match your filter" : "No mods found — click Scan to load"}
          </div>
        )}

        {filtered.map((mod, i) => {
          const isSelected = selected.has(mod.id);
          return (
            <div
              key={mod.id}
              onClick={(e) => handleRowClick(e, mod)}
              style={{
                display: "grid", gridTemplateColumns: colGrid,
                padding: "7px 12px", alignItems: "center",
                background: isSelected ? "rgba(74,222,128,0.07)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                opacity: mod.enabled ? 1 : 0.45,
                cursor: "pointer", userSelect: "none", transition: "background 0.08s",
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-3)"; }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)"; }}
            >
              {/* Checkbox — toggles without clearing others */}
              <div onClick={(e) => handleCheckboxClick(e, mod.id)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                {isSelected ? <CheckSquare size={14} color="var(--accent)" /> : <Square size={14} color="var(--text-muted)" />}
              </div>

              {/* Icon */}
              <div>
                {mod.icon_url ? (
                  <Image src={mod.icon_url} alt={mod.name} width={28} height={28}
                    style={{ borderRadius: 3, objectFit: "cover", display: "block" }} unoptimized />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 3, background: "var(--surface-3)", border: "1px solid var(--border)" }} />
                )}
              </div>

              {/* Name */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  {mod.name}
                  {mod.update_available && (
                    <span style={{ background: "var(--yellow-dim)", color: "var(--yellow)", fontSize: 9, padding: "1px 5px", borderRadius: 2, fontWeight: 700, border: "1px solid rgba(251,191,36,0.25)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                      Update
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {mod.filename}
                </div>
              </div>

              {/* Version */}
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{mod.version ?? "—"}</div>

              {/* Last Modified */}
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{formatDate(mod.last_modified)}</div>

              {/* Provider */}
              <div>
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                  background: mod.provider === "Modrinth" ? "var(--blue-dim)" : "rgba(67,76,94,0.3)",
                  color: mod.provider === "Modrinth" ? "var(--blue)" : "var(--text-muted)",
                  border: mod.provider === "Modrinth" ? "1px solid rgba(96,165,250,0.2)" : "1px solid var(--border)",
                }}>
                  {mod.provider}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onToggle([mod.id])} className="btn btn-ghost" style={{ padding: "3px 5px" }} title={mod.enabled ? "Disable" : "Enable"}>
                  {mod.enabled ? <ToggleRight size={15} color="var(--accent)" /> : <ToggleLeft size={15} color="var(--text-muted)" />}
                </button>

                {mod.update_available && (
                  <button onClick={() => onUpdate(mod.id)} disabled={updating.has(mod.id)} className="btn btn-ghost" style={{ padding: "3px 5px" }} title={`Update to ${mod.latest_version}`}>
                    {updating.has(mod.id)
                      ? <RefreshCw size={13} color="var(--yellow)" style={{ animation: "spin 1s linear infinite" }} />
                      : <ArrowUpCircle size={13} color="var(--yellow)" />}
                  </button>
                )}

                {mod.homepage_url && (
                  <a href={mod.homepage_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "3px 5px" }} title="View on Modrinth">
                    <ExternalLink size={13} />
                  </a>
                )}

                <button onClick={() => onDelete([mod.id])} className="btn btn-ghost" style={{ padding: "3px 5px" }} title="Delete mod"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--red)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "")}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
