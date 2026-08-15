"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { TrainingLibraryFavoriteButton } from "@/componentes/training-library-favorite-button";
import { filterTrainingLibraryBlocks, trainingLibraryLastUsedLabel } from "@/lib/training-library";
import { TRAINING_BLOCK_LABELS } from "@/lib/training-blocks";
import type { TrainingLibraryBlock, TrainingLibraryFolder, TrainingLibraryView } from "@/types/training-library";

function blockSummary(block: TrainingLibraryBlock) {
  const exercises = `${block.content.exercises.length} ejercicio${block.content.exercises.length === 1 ? "" : "s"}`;
  if (block.content.durationSeconds) return `${exercises} · ${Math.round(block.content.durationSeconds / 60)} min`;
  if (block.content.rounds) return `${exercises} · ${block.content.rounds} rondas`;
  return exercises;
}

async function responseError(response: Response) {
  try { return ((await response.json()) as { error?: string }).error ?? "No se pudo actualizar el favorito."; }
  catch { return "No se pudo actualizar el favorito."; }
}

export function TrainingLibraryBlockPicker({ blocks, folders, ready, error, busyId, close, add, onBlockChanged }: {
  blocks: TrainingLibraryBlock[];
  folders: TrainingLibraryFolder[];
  ready: boolean;
  error: string;
  busyId: string;
  close: () => void;
  add: (block: TrainingLibraryBlock) => void;
  onBlockChanged: (block: TrainingLibraryBlock) => void;
}) {
  const [view, setView] = useState<TrainingLibraryView>("favorites");
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("all");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [favoriteBusy, setFavoriteBusy] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const tags = useMemo(() => [...new Set(blocks.filter((block) => block.status === "active").flatMap((block) => block.tags))].sort((left, right) => left.localeCompare(right, "es")), [blocks]);
  const visible = useMemo(() => filterTrainingLibraryBlocks(blocks, { query, folderId, type, tag, status: "active", view }), [blocks, folderId, query, tag, type, view]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busyId && !favoriteBusy) { event.preventDefault(); close(); } };
    document.addEventListener("keydown", handleEscape);
    if (window.matchMedia("(min-width: 640px)").matches) searchRef.current?.focus();
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busyId, close, favoriteBusy]);

  async function toggleFavorite(block: TrainingLibraryBlock) {
    if (favoriteBusy || busyId || block.status !== "active") return;
    setFavoriteBusy(block.id); setFavoriteError("");
    try {
      const response = await fetch(`/api/training-library/blocks/${block.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !block.isFavorite }) });
      if (!response.ok) return setFavoriteError(await responseError(response));
      onBlockChanged(await response.json() as TrainingLibraryBlock);
    } catch { setFavoriteError("No se pudo actualizar el favorito."); }
    finally { setFavoriteBusy(""); }
  }

  const emptyMessage = view === "favorites" ? "No tenés bloques favoritos." : view === "recent" ? "Todavía no usaste bloques de la Biblioteca." : "No hay bloques activos que coincidan.";
  return <div className="fixed inset-0 z-[70] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="block-library-picker-title" className="flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-[#121212] text-white sm:max-w-3xl sm:rounded-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4 sm:p-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300">Biblioteca · Bloques</p><h2 id="block-library-picker-title" className="mt-1 text-xl font-black">Agregar desde Biblioteca</h2><p className="mt-1 text-xs text-zinc-500">Se insertará una copia independiente al final de la secuencia.</p></div><button type="button" disabled={Boolean(busyId || favoriteBusy)} onClick={close} aria-label="Cerrar selector de Biblioteca" className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-lg disabled:opacity-50">×</button></header>
      <div className="min-w-0 overflow-y-auto p-4 sm:p-5">
        <nav aria-label="Vista rápida de Biblioteca" className="mb-3 grid grid-cols-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">{([['favorites', 'Favoritos'], ['recent', 'Recientes'], ['all', 'Todos']] as const).map(([value, title]) => <button key={value} type="button" aria-current={view === value ? "page" : undefined} onClick={() => setView(value)} className={`min-h-10 min-w-0 rounded-lg px-1 text-xs font-bold transition sm:text-sm ${view === value ? "bg-yellow-400/[.12] text-yellow-300" : "text-zinc-400"}`}>{title}</button>)}</nav>
        <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Buscar por nombre, tipo, tag o carpeta…" className={inputClass} />
        <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 sm:open"><summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-sm font-bold text-zinc-300">Filtros</summary><div className="grid gap-2 border-t border-zinc-800 p-3 sm:grid-cols-3"><select aria-label="Carpeta" value={folderId} onChange={(event) => setFolderId(event.target.value)} className={inputClass}><option value="all">Todas las carpetas</option><option value="unfiled">Sin carpeta</option>{folders.filter((folder) => folder.status === "active").map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><select aria-label="Tipo de bloque" value={type} onChange={(event) => setType(event.target.value)} className={inputClass}><option value="all">Todos los tipos</option>{Object.entries(TRAINING_BLOCK_LABELS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><select aria-label="Tag" value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}><option value="all">Todos los tags</option>{tags.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></details>
        {favoriteError && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{favoriteError}</p>}
        {error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}<span className="mt-1 block text-xs text-zinc-400">Podés cerrar este selector y usar “Crear nuevo”.</span></p> : !ready ? <p className="mt-4 rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-500">Cargando bloques…</p> : visible.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500"><p>{emptyMessage}</p>{view === "favorites" && <p className="mt-2 text-xs">Marcá con ★ los bloques que usás más.</p>}</div> : <div className="mt-4 space-y-2">{visible.map((block) => <article key={block.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/65 p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-yellow-400/[.09] px-2 py-1 text-[10px] font-black uppercase text-yellow-300">{TRAINING_BLOCK_LABELS[block.type]}</span><span className="truncate text-xs text-zinc-500">{block.folder?.name ?? "Sin carpeta"}</span></div><h3 className="mt-2 break-words text-sm font-black text-zinc-100">{block.name}</h3><p className="mt-1 text-xs text-zinc-400">{blockSummary(block)}</p>{view === "recent" && <p className="mt-1 text-[10px] text-zinc-500">{trainingLibraryLastUsedLabel(block.lastUsedAt)}</p>}<div className="mt-2 flex flex-wrap gap-1">{block.tags.slice(0, 4).map((value) => <span key={value} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">{value}</span>)}</div></div><div className="flex shrink-0 gap-1"><TrainingLibraryFavoriteButton block={block} busy={favoriteBusy === block.id} toggle={(item) => void toggleFavorite(item)} /><button type="button" disabled={Boolean(busyId || favoriteBusy)} onClick={() => add(block)} className="min-h-10 rounded-lg border border-yellow-400/30 px-3 text-xs font-black text-yellow-300 disabled:opacity-40">{busyId === block.id ? "Agregando…" : "Agregar"}</button></div></div></article>)}</div>}
      </div>
    </section>
  </div>;
}
