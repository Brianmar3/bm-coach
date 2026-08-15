"use client";

import { useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { TrainingLibraryFavoriteButton } from "@/componentes/training-library-favorite-button";
import { EmptyState, ErrorState, ListSkeleton } from "@/componentes/async-states";
import { filterTrainingLibraryBlocks, trainingLibraryLastUsedLabel } from "@/lib/training-library";
import type { TrainingBlockType } from "@/types/gestion";
import type { TrainingLibraryBlock, TrainingLibraryFolder, TrainingLibraryStatus, TrainingLibraryView } from "@/types/training-library";

const typeLabels: Record<TrainingBlockType, string> = { STRENGTH: "Fuerza", ROUNDS: "Circuito", INTERVAL: "Intervalos", EMOM: "EMOM", AMRAP: "AMRAP", FOR_TIME: "For time", FREE: "Bloque libre" };
const showDate = (value: string) => new Date(value).toLocaleDateString("es-AR");

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export function TrainingLibraryBlocksPanel({ blocks, folders, ready, loadError = "", retry, onNew, onEdit, onBlockChanged, onFoldersChanged }: {
  blocks: TrainingLibraryBlock[];
  folders: TrainingLibraryFolder[];
  ready: boolean;
  loadError?: string;
  retry?: () => void;
  onNew: () => void;
  onEdit: (block: TrainingLibraryBlock) => void;
  onBlockChanged: (block: TrainingLibraryBlock) => void;
  onFoldersChanged: (folders: TrainingLibraryFolder[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("all");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState<TrainingLibraryStatus>("active");
  const [view, setView] = useState<TrainingLibraryView>("all");
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState("");
  const [favoriteBusy, setFavoriteBusy] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [statusError, setStatusError] = useState("");
  const tags = useMemo(() => [...new Set(blocks.flatMap((block) => block.tags))].sort((left, right) => left.localeCompare(right, "es")), [blocks]);
  const visible = useMemo(() => filterTrainingLibraryBlocks(blocks, { query, folderId, type, tag, status, view: status === "active" ? view : "all" }), [blocks, folderId, query, status, tag, type, view]);
  const hasFilters = Boolean(query.trim()) || folderId !== "all" || type !== "all" || tag !== "all";
  async function changeStatus(block: TrainingLibraryBlock) {
    const action = block.status === "active" ? "archive" : "restore";
    setStatusBusy(block.id); setStatusError("");
    try {
      const response = await fetch(`/api/training-library/blocks/${block.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) return setStatusError(await responseError(response, "No se pudo cambiar el estado del bloque."));
      onBlockChanged(await response.json() as TrainingLibraryBlock);
    } catch { setStatusError("No se pudo cambiar el estado del bloque."); }
    finally { setStatusBusy(""); }
  }
  async function toggleFavorite(block: TrainingLibraryBlock) {
    if (favoriteBusy || block.status !== "active") return;
    setFavoriteBusy(block.id); setFavoriteError("");
    try {
      const response = await fetch(`/api/training-library/blocks/${block.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !block.isFavorite }) });
      if (!response.ok) return setFavoriteError(await responseError(response, "No se pudo actualizar el favorito."));
      onBlockChanged(await response.json() as TrainingLibraryBlock);
    } catch { setFavoriteError("No se pudo actualizar el favorito."); }
    finally { setFavoriteBusy(""); }
  }
  const emptyMessage = hasFilters
    ? "No encontramos resultados con estos filtros."
    : status === "archived"
    ? "No hay bloques archivados que coincidan."
    : view === "favorites" ? "No tenés bloques favoritos."
      : view === "recent" ? "Todavía no usaste bloques de la Biblioteca."
        : "No hay bloques activos que coincidan.";
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex rounded-xl border border-zinc-800 bg-[#111] p-1"><button type="button" onClick={() => setStatus("active")} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${status === "active" ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Activos</button><button type="button" onClick={() => { setStatus("archived"); setView("all"); }} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${status === "archived" ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Archivados</button></div>
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setFolderManagerOpen(true)} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300">Gestionar carpetas</button><button type="button" onClick={onNew} className="min-h-10 rounded-xl border border-yellow-400/30 px-3 text-sm font-bold text-yellow-300">+ Nuevo bloque</button></div>
    </div>
    {status === "active" && <nav aria-label="Vista de bloques" className="mb-3 grid grid-cols-3 rounded-xl border border-zinc-800 bg-[#111] p-1">{([['all', 'Todos'], ['favorites', 'Favoritos'], ['recent', 'Recientes']] as const).map(([value, title]) => <button key={value} type="button" aria-current={view === value ? "page" : undefined} onClick={() => setView(value)} className={`min-h-10 min-w-0 rounded-lg px-1 text-xs font-bold transition sm:text-sm ${view === value ? "bg-yellow-400/[.12] text-yellow-300" : "text-zinc-400"}`}>{title}</button>)}</nav>}
    <section className="mb-4 rounded-2xl border border-zinc-800 bg-[#121212] p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(150px,.7fr))]"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, tipo, tag o carpeta…" className={`${inputClass} sm:col-span-2 xl:col-span-1`} /><select aria-label="Carpeta" value={folderId} onChange={(event) => setFolderId(event.target.value)} className={inputClass}><option value="all">Todas las carpetas</option><option value="unfiled">Sin carpeta</option>{folders.filter((folder) => folder.status === "active").map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><select aria-label="Tipo de bloque" value={type} onChange={(event) => setType(event.target.value)} className={inputClass}><option value="all">Todos los tipos</option>{Object.entries(typeLabels).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><select aria-label="Tag" value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}><option value="all">Todos los tags</option>{tags.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></section>
    {(favoriteError || statusError) && <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{favoriteError || statusError}</p>}
    {!ready ? <ListSkeleton rows={4} cardHeight="h-40" /> : loadError && blocks.length === 0 ? <ErrorState title="No se pudieron cargar los bloques." description={loadError} retry={retry ?? (() => undefined)} /> : <>{loadError && <div className="mb-3"><ErrorState compact title="No pudimos actualizar la Biblioteca." retry={retry ?? (() => undefined)} /></div>}{visible.length === 0 ? <EmptyState title={emptyMessage} description={status === "active" && view === "favorites" ? "Marcá con ★ los bloques que usás más." : undefined} action={hasFilters ? <button type="button" onClick={() => { setQuery(""); setFolderId("all"); setType("all"); setTag("all"); }} className="min-h-11 px-4 text-sm font-bold text-yellow-300">Limpiar filtros</button> : status === "active" && view === "all" ? <button type="button" onClick={onNew} className="min-h-11 px-4 text-sm font-bold text-yellow-300">Crear bloque</button> : undefined} /> : <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{visible.map((block) => <article key={block.id} className="min-w-0 rounded-2xl border border-white/[.07] bg-[#111] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-lg bg-yellow-400/[.09] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-yellow-300">{typeLabels[block.type]}</span><h3 className="mt-2 truncate text-base font-black">{block.name}</h3><p className="mt-1 text-xs text-zinc-500">{block.folder?.name ?? "Sin carpeta"}</p></div><div className="flex shrink-0 gap-1">{block.status === "active" && <TrainingLibraryFavoriteButton block={block} busy={favoriteBusy === block.id} toggle={(item) => void toggleFavorite(item)} />}<button type="button" onClick={() => onEdit(block)} className="min-h-10 rounded-lg border border-yellow-400/25 px-3 text-xs font-bold text-zinc-100">Abrir</button></div></div><div className="mt-3 flex flex-wrap gap-1.5">{block.tags.slice(0, 4).map((value) => <span key={value} className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">{value}</span>)}{block.tags.length > 4 && <span className="px-1 py-1 text-[10px] text-zinc-500">+{block.tags.length - 4}</span>}</div><div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-800 pt-3"><div><p className="text-xs text-zinc-300">{block.content.exercises.length} ejercicios{block.content.durationSeconds ? ` · ${Math.round(block.content.durationSeconds / 60)} min` : ""}</p><p className="mt-1 text-[10px] text-zinc-500">{status === "active" && view === "recent" ? trainingLibraryLastUsedLabel(block.lastUsedAt) : `Modificado ${showDate(block.updatedAt)}`}</p></div><button type="button" disabled={statusBusy === block.id} onClick={() => void changeStatus(block)} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-zinc-400 disabled:opacity-50">{block.status === "active" ? "Archivar" : "Restaurar"}</button></div></article>)}</section>}</>}
    {folderManagerOpen && <FolderManager folders={folders} close={() => setFolderManagerOpen(false)} changed={onFoldersChanged} />}
  </>;
}

function FolderManager({ folders, close, changed }: { folders: TrainingLibraryFolder[]; close: () => void; changed: (folders: TrainingLibraryFolder[]) => void }) {
  const [name, setName] = useState("");
  const [draftNames, setDraftNames] = useState<Record<string, string>>(() => Object.fromEntries(folders.map((folder) => [folder.id, folder.name])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) close(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, close]);
  async function create() {
    setBusy("new"); setError("");
    const response = await fetch("/api/training-library/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) setError(await responseError(response, "No se pudo crear la carpeta.")); else { const folder = await response.json() as TrainingLibraryFolder; changed([...folders, folder].sort((a, b) => a.name.localeCompare(b.name, "es"))); setName(""); setDraftNames((current) => ({ ...current, [folder.id]: folder.name })); }
    setBusy("");
  }
  async function update(folder: TrainingLibraryFolder, action: "rename" | "archive" | "restore") {
    setBusy(folder.id); setError("");
    const response = await fetch(`/api/training-library/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, name: draftNames[folder.id] }) });
    if (!response.ok) setError(await responseError(response, "No se pudo actualizar la carpeta.")); else { const saved = await response.json() as TrainingLibraryFolder; changed(folders.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.name.localeCompare(b.name, "es"))); }
    setBusy("");
  }
  async function remove(folder: TrainingLibraryFolder) {
    if (!window.confirm(`¿Eliminar la carpeta “${folder.name}”?`)) return;
    setBusy(folder.id); setError("");
    const response = await fetch(`/api/training-library/folders/${folder.id}`, { method: "DELETE" });
    if (!response.ok) setError(await responseError(response, "No se pudo eliminar la carpeta.")); else changed(folders.filter((item) => item.id !== folder.id));
    setBusy("");
  }
  return <div className="fixed inset-0 z-[75] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="folder-manager-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-[#121212] p-5 sm:max-w-2xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="folder-manager-title" className="text-xl font-black">Gestionar carpetas</h2><p className="mt-1 text-xs text-zinc-500">Una carpeta con bloques debe vaciarse antes de archivarla o eliminarla.</p></div><button type="button" onClick={close} className="min-h-10 rounded-lg px-3 text-sm text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-5 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nueva carpeta" className={inputClass} /><button type="button" disabled={!name.trim() || busy === "new"} onClick={() => void create()} className="min-h-11 shrink-0 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-40">Crear</button></div><div className="mt-4 space-y-2">{folders.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Todavía no hay carpetas.</p> : folders.map((folder) => <article key={folder.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><input value={draftNames[folder.id] ?? folder.name} onChange={(event) => setDraftNames((current) => ({ ...current, [folder.id]: event.target.value }))} className={`${inputClass} min-w-0 flex-1`} /><span className="text-xs text-zinc-500">{folder.blockCount} bloques</span><button type="button" disabled={busy === folder.id || draftNames[folder.id] === folder.name} onClick={() => void update(folder, "rename")} className="min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-bold disabled:opacity-30">Renombrar</button>{folder.status === "active" ? <button type="button" disabled={busy === folder.id || folder.blockCount > 0} onClick={() => void update(folder, "archive")} className="min-h-9 rounded-lg px-2 text-xs text-zinc-400 disabled:opacity-30">Archivar</button> : <button type="button" disabled={busy === folder.id} onClick={() => void update(folder, "restore")} className="min-h-9 rounded-lg px-2 text-xs text-yellow-300 disabled:opacity-30">Restaurar</button>}<button type="button" disabled={busy === folder.id || folder.blockCount > 0} onClick={() => void remove(folder)} className="min-h-9 rounded-lg px-2 text-xs text-red-300 disabled:opacity-30">Eliminar</button></div></article>)}</div></section></div>;
}
