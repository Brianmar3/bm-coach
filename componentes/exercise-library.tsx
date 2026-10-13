"use client";
import { LibraryDragHandle, useLibraryCopyBusy } from "@/componentes/routine-library-drag";
import { routineDrawerKeyboard } from "@/lib/routine-drawer-keyboard";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { EXERCISE_LIBRARY_PAGE_SIZE, filterExerciseLibrary, getExerciseMediaUrl, normalizeLibraryText, paginateExerciseLibrary } from "@/lib/exercise-library";
import type { BMExercise, BMExerciseSummary, ExerciseLibraryFacet } from "@/types/exercise-library";


const ExerciseSessionContext = createContext<{ recent: string[]; favorites: string[]; used: (id: string) => void; favorite: (id: string) => void }>({ recent: [], favorites: [], used: () => {}, favorite: () => {} });
export function RoutineExerciseLibrarySession({ children }: { children: React.ReactNode }) {
  const [recent, setRecent] = useState<string[]>([]), [favorites, setFavorites] = useState<string[]>([]);
  return <ExerciseSessionContext.Provider value={{ recent, favorites, used: id => setRecent(current => [id, ...current.filter(value => value !== id)].slice(0, 30)), favorite: id => setFavorites(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }}>{children}</ExerciseSessionContext.Provider>;
}

type CatalogResponse = { total: number; items: BMExerciseSummary[]; facets: { bodyParts: ExerciseLibraryFacet[]; equipment: ExerciseLibraryFacet[]; targets: ExerciseLibraryFacet[] }; mediaEnabled: boolean };

export function ExerciseThumbnail({ exercise, mediaEnabled }: { exercise: BMExerciseSummary; mediaEnabled: boolean }) {
  const src = getExerciseMediaUrl(exercise, "thumbnail", mediaEnabled);
  if (!src) return null;
  return <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-zinc-950"><Image src={src} alt="" loading="lazy" unoptimized width={180} height={180} className="h-full w-full object-cover" /></span>;
}

export function ExerciseMedia({ exercise, mediaEnabled }: { exercise: BMExercise; mediaEnabled: boolean }) {
  const src = getExerciseMediaUrl(exercise, "gif", mediaEnabled);
  if (!src) return null;
  return <div className="mx-auto grid size-[180px] place-items-center overflow-hidden rounded-2xl border border-zinc-800 bg-black"><Image src={src} alt={`Demostración de ${exercise.displayNameEs}`} loading="lazy" unoptimized width={180} height={180} className="size-[180px] object-contain" /></div>;
}

export function ExerciseDetail({ exercise, mediaEnabled, onSelect }: { exercise: BMExercise; mediaEnabled: boolean; onSelect?: (exercise: BMExercise) => void }) {
  const steps = exercise.instructionStepsEs.length ? exercise.instructionStepsEs : [exercise.instructionsEs];
  return <div className="space-y-4"><ExerciseMedia exercise={exercise} mediaEnabled={mediaEnabled} /><div><h2 className="text-xl font-black">{exercise.displayNameEs}</h2><p className="mt-1 text-sm text-zinc-400">Músculo: {exercise.targetMuscleLabelEs} · Equipamiento: {exercise.equipmentLabelEs}</p><p className="mt-1 text-xs text-zinc-500">Parte corporal: {exercise.bodyPartLabelEs}</p>{exercise.secondaryMusclesEs.length > 0 && <p className="mt-1 text-xs text-zinc-500">Secundarios: {exercise.secondaryMusclesEs.join(", ")}</p>}</div><div><h3 className="text-xs font-black uppercase tracking-wider text-yellow-400">Instrucciones del ejercicio</h3><ol className="mt-2 space-y-2 text-sm leading-5 text-zinc-300">{steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2"><span className="text-yellow-400">{index + 1}.</span><span>{step}</span></li>)}</ol></div>{mediaEnabled && exercise.attribution && <p className="text-[10px] text-zinc-500">{exercise.attribution}</p>}{onSelect && <button type="button" onClick={() => onSelect(exercise)} className="min-h-11 w-full rounded-xl border border-yellow-400/35 bg-yellow-400/[.06] text-sm font-black text-yellow-300">Seleccionar ejercicio</button>}</div>;
}

export function ExerciseLibraryPicker({ open, onClose, onSelect, onMediaAvailabilityChange, integrated = false }: { integrated?: boolean; open: boolean; onClose: () => void; onSelect: (exercise: BMExercise) => void; onMediaAvailabilityChange?: (available: boolean) => void }) {
  const copyBusy = useLibraryCopyBusy();
  const session = useContext(ExerciseSessionContext);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addedId, setAddedId] = useState("");
  const [view, setView] = useState("all");
  const [busy, setBusy] = useState("");
  const [failure, setFailure] = useState("");
  const [added, setAdded] = useState("");
  useEffect(() => { if (!added) return; const timer = setTimeout(() => { setAdded(""); setAddedId(""); }, 2600); return () => clearTimeout(timer); }, [added]);
  const lastAdd = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => { if (open) { const previous = document.activeElement as HTMLElement | null; searchRef.current?.focus(); return () => { requestRef.current?.abort(); previous?.focus(); }; } }, [open]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [query, setQuery] = useState(""); const [bodyPart, setBodyPart] = useState(""); const [equipment, setEquipment] = useState(""); const [target, setTarget] = useState("");
  const [selected, setSelected] = useState<BMExercise | null>(null);
  const [visibleCount, setVisibleCount] = useState(EXERCISE_LIBRARY_PAGE_SIZE);
  useEffect(() => { if (!open || catalog) return; const controller = new AbortController(); fetch("/api/exercise-library", { signal: controller.signal }).then((response) => response.json() as Promise<CatalogResponse>).then((body) => { setCatalog(body); onMediaAvailabilityChange?.(body.mediaEnabled); }).catch(() => { setCatalog(null); onMediaAvailabilityChange?.(false); }); return () => controller.abort(); }, [catalog, onMediaAvailabilityChange, open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  const filtered = useMemo(() => catalog ? filterExerciseLibrary(catalog.items, { query, bodyPart, equipment, targetMuscle: target }) : [], [bodyPart, catalog, equipment, query, target]);
  const scoped = useMemo(() => !integrated || view === "all" ? filtered : view === "favorites" ? filtered.filter(item => session.favorites.includes(item.id)) : session.recent.flatMap(id => filtered.filter(item => item.id === id)), [filtered, integrated, view, session.favorites, session.recent]);
  const visible = useMemo(() => paginateExerciseLibrary(scoped, visibleCount), [scoped, visibleCount]);
  const resultLabel = query.trim() ? `${scoped.length.toLocaleString("es-AR")} resultados para “${query.trim()}”` : `${scoped.length.toLocaleString("es-AR")} resultados`;
  async function inspect(item: BMExerciseSummary) { const response = await fetch(`/api/exercise-library/${encodeURIComponent(item.id)}`); const body = await response.json() as { exercise: BMExercise }; if (response.ok) setSelected(body.exercise); }
  async function quickAdd(item: BMExerciseSummary) {
    if (busy || requestRef.current || Date.now() - lastAdd.current < 450) return;
    const controller = new AbortController(); requestRef.current = controller;
    setBusy(item.id); setFailure("");
    try { const response = await fetch(`/api/exercise-library/${encodeURIComponent(item.id)}`, { signal: controller.signal }); if (!response.ok) throw new Error(); const body = await response.json() as { exercise: BMExercise }; if (!controller.signal.aborted) { onSelect(body.exercise); session.used(item.id); setAddedId(item.id); setAdded(body.exercise.displayNameEs + " agregado"); } }
    catch { if (!controller.signal.aborted) setFailure("No se pudo agregar el ejercicio. Intentá nuevamente."); }
    finally { requestRef.current = null; if (!controller.signal.aborted) setBusy(""); }
  }
  const activeFilters = [bodyPart, equipment, target].filter(Boolean).length;
  if (!open) return null;
  return <div onKeyDown={routineDrawerKeyboard} className={integrated ? "routine-library-drawer exercise-picker" : "fixed inset-0 z-[80] bg-black/80 p-2 backdrop-blur-sm sm:p-6"} role="dialog" aria-modal={!integrated} aria-label="Biblioteca de ejercicios BM"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#0b0b0b]"><header className="flex items-center justify-between border-b border-zinc-800 p-3 sm:p-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-yellow-400">Biblioteca BM</p><h1 className="text-lg font-black">Elegí un ejercicio</h1><p className="mt-0.5 text-xs text-zinc-500">{catalog ? `${catalog.total.toLocaleString("es-AR")} ejercicios` : "Cargando catálogo…"}</p></div><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm">Cerrar</button></header>{selected ? <div className="overflow-y-auto p-4"><button type="button" onClick={() => setSelected(null)} className="mb-4 text-sm font-bold text-yellow-300">← Volver a resultados</button><ExerciseDetail exercise={selected} mediaEnabled={Boolean(catalog?.mediaEnabled)} onSelect={(exercise) => { onSelect(exercise); if (integrated) { session.used(exercise.id); setSelected(null); } else onClose(); }} /></div> : <><div className="exercise-picker-controls grid gap-2 border-b border-zinc-800 p-3 sm:grid-cols-4"><input ref={searchRef} type="search" aria-label="Buscar ejercicio" onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(EXERCISE_LIBRARY_PAGE_SIZE); }} placeholder="Buscar ejercicio..." className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-yellow-400" /><button type="button" className="exercise-picker-filter-toggle" aria-expanded={filtersOpen} aria-controls="exercise-picker-filters" onClick={() => setFiltersOpen(value => !value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>Filtros{activeFilters > 0 ? ` · ${activeFilters}` : ""}</button><div id="exercise-picker-filters" className="exercise-picker-filters" data-open={filtersOpen}>{[[bodyPart, setBodyPart, catalog?.facets.bodyParts, "Parte corporal"], [equipment, setEquipment, catalog?.facets.equipment, "Equipamiento"], [target, setTarget, catalog?.facets.targets, "Músculo objetivo"]].map(([value, setter, options, label]) => <select aria-label={label as string} key={label as string} value={value as string} onChange={(event) => { (setter as (value: string) => void)(event.target.value); setVisibleCount(EXERCISE_LIBRARY_PAGE_SIZE); }} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs"><option value="">{label as string}: todos</option>{(options as ExerciseLibraryFacet[] | undefined)?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>)}<button type="button" className="exercise-picker-clear" disabled={!activeFilters} onClick={() => { setBodyPart(""); setEquipment(""); setTarget(""); setVisibleCount(EXERCISE_LIBRARY_PAGE_SIZE); }}>Limpiar filtros</button></div></div><div className="exercise-picker-results min-h-0 flex-1 overflow-y-auto p-3">{integrated && <><nav aria-label="Ejercicios de la sesión" className="exercise-picker-tabs flex gap-2 mb-2">{[["all","Biblioteca"],["recent","Recientes"],["favorites","Favoritos"]].map(([key,label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className="px-2 text-xs">{label}</button>)}</nav><p className="exercise-picker-session text-xs text-zinc-500 mb-2">Recientes y favoritos de esta sesión de edición.</p><p role="status" className="exercise-picker-feedback text-xs text-yellow-300">{added}</p>{failure && <p role="alert">{failure}</p>}</>}<div className="exercise-picker-count mb-3 flex flex-wrap items-center justify-between gap-1 text-xs text-zinc-500"><span>{resultLabel}</span>{visible.length > 0 && <span>Mostrando 1–{visible.length.toLocaleString("es-AR")} de {scoped.length.toLocaleString("es-AR")}</span>}</div><div className={integrated ? "routine-library-exercises" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"}>{visible.map((item) => <div key={item.id} className={integrated ? "routine-library-exercise" : "min-w-0"}>{integrated && <LibraryDragHandle disabled={Boolean(busy)} source={{ kind: "exercise", title: item.displayNameEs, resolve: async signal => { const response = await fetch(`/api/exercise-library/${encodeURIComponent(item.id)}`, { signal }); if (!response.ok) throw new Error(); const body = await response.json() as { exercise: BMExercise }; return { kind: "exercise", exercise: body.exercise }; }, done: () => { lastAdd.current = Date.now(); session.used(item.id); setAdded(item.displayNameEs + " agregado"); } }} />}<button type="button" onClick={() => void inspect(item)} data-has-media={Boolean(getExerciseMediaUrl(item, "thumbnail", Boolean(catalog?.mediaEnabled)))} className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-left hover:border-yellow-400/30"><ExerciseThumbnail exercise={item} mediaEnabled={Boolean(catalog?.mediaEnabled)} /><strong className="exercise-picker-name mt-2 block truncate text-xs">{item.displayNameEs}</strong><span className="exercise-picker-muscle mt-0.5 block truncate text-[10px] text-zinc-500">Músculo: {item.targetMuscleLabelEs}</span><span className="exercise-picker-equipment mt-0.5 block truncate text-[10px] text-zinc-500">Equipamiento: {item.equipmentLabelEs}</span></button>{integrated && <div className="exercise-picker-actions flex gap-1"><button type="button" aria-label={`Favorito: ${item.displayNameEs}`} aria-pressed={session.favorites.includes(item.id)} onClick={() => session.favorite(item.id)} className="px-3 text-yellow-300">{session.favorites.includes(item.id) ? "★" : "☆"}</button><button type="button" disabled={Boolean(busy) || copyBusy} onClick={event => { if (event.detail < 2) void quickAdd(item); }} className="exercise-picker-add flex-1 text-xs text-yellow-300">{busy === item.id ? "Agregando…" : addedId === item.id ? "✓ Agregado" : "Agregar"}</button></div>}</div>)}</div>{catalog && !visible.length && <p className="p-8 text-center text-sm text-zinc-500">No encontramos ejercicios con esos filtros.</p>}{visible.length < scoped.length && <button type="button" onClick={() => setVisibleCount((current) => current + EXERCISE_LIBRARY_PAGE_SIZE)} className="mx-auto mt-4 block min-h-11 rounded-xl border border-yellow-400/35 px-6 text-sm font-black text-yellow-300">Cargar más</button>}</div></>}</div></div>;
}

export function matchesExerciseQuery(exercise: BMExerciseSummary, query: string) { return normalizeLibraryText(`${exercise.displayNameEs} ${exercise.name} ${exercise.equipmentLabelEs} ${exercise.equipment} ${exercise.targetMuscleLabelEs} ${exercise.targetMuscle}`).includes(normalizeLibraryText(query)); }
