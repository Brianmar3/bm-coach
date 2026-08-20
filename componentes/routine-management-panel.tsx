"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoutineStatusSection } from "@/lib/routine-list-organization";
import type { TrainingRoutine } from "@/types/gestion";

type Mode = "rutinas" | "plantillas" | "asignaciones";
type Actions = {
  openPlan: (routine: TrainingRoutine) => void;
  openTracking: (routine: TrainingRoutine) => void;
  edit: (routine: TrainingRoutine) => void;
  duplicate: (routine: TrainingRoutine) => void;
  saveAsTemplate: (routine: TrainingRoutine) => void;
  useAsBase: (routine: TrainingRoutine) => void;
  useTemplate: (routine: TrainingRoutine) => void;
  manageAssignments: (routine: TrainingRoutine) => void;
  archive: (routine: TrainingRoutine) => void;
  restore: (routine: TrainingRoutine) => void;
  history: (routine: TrainingRoutine) => void;
  remove: (routine: TrainingRoutine) => Promise<boolean>;
};

const showDate = (value: string) => value ? new Date(value).toLocaleDateString("es-AR") : "Sin registros";
const exerciseCount = (routine: TrainingRoutine) => routine.days.reduce((total, day) => total + day.exercises.length, 0);
const students = (routine: TrainingRoutine) => (routine.status === "archivada" ? routine.historicalStudents : routine.students);
const studentNames = (routine: TrainingRoutine) => {
  const assigned = students(routine);
  if (!assigned.length) return "Sin asignar";
  return assigned.length === 1 ? assigned[0].name : `${assigned[0].name} +${assigned.length - 1}`;
};

function relativeDate(value: string) {
  if (!value) return "Sin registros";
  const date = new Date(value); const today = new Date();
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  return days === 0 ? "Hoy" : days === 1 ? "Ayer" : days > 1 ? `Hace ${days} días` : showDate(value);
}

function StatusBadge({ routine }: { routine: TrainingRoutine }) {
  const tone = routine.status === "activa" ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300" : routine.status === "borrador" ? "border-sky-400/15 bg-sky-400/10 text-sky-300" : "border-zinc-600/30 bg-zinc-700/30 text-zinc-300";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold capitalize ${tone}`}>{routine.status}</span>;
}

function Progress({ routine }: { routine: TrainingRoutine }) {
  const value = routine.managementSummary?.progressPercentage;
  if (typeof value !== "number") return <span className="text-xs text-zinc-500">Sin métrica</span>;
  return <div className="min-w-20"><strong className="text-xs text-zinc-200">{value}%</strong><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800"><span className="block h-full rounded-full bg-yellow-400" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}

function Trend({ values = [] }: { values?: number[] }) {
  const maximum = Math.max(1, ...values);
  return <div className="flex h-20 items-end gap-2" aria-label="Sesiones completadas durante las últimas cuatro semanas">{values.map((value, index) => <div key={index} className="flex flex-1 flex-col items-center gap-1"><span className="text-[10px] text-zinc-500">{value}</span><span className="w-full rounded-t bg-gradient-to-t from-amber-700 to-yellow-300" style={{ height: `${Math.max(5, (value / maximum) * 48)}px` }} /><span className="text-[9px] text-zinc-600">S{index + 1}</span></div>)}</div>;
}

function Preview({ routine, close, tracking }: { routine: TrainingRoutine; close: () => void; tracking: () => void }) {
  const summary = routine.managementSummary;
  const person = students(routine)[0];
  return <aside className="h-full border border-white/[.07] bg-[linear-gradient(145deg,#171717,#0b0b0b)] p-4 shadow-2xl xl:rounded-2xl">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Vista rápida</p><h2 className="mt-2 truncate text-lg font-black">{person?.name ?? "Sin alumno asignado"}</h2><p className="mt-1 truncate text-sm text-yellow-300">{routine.name}</p></div><button type="button" onClick={close} aria-label="Cerrar panel" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-700 text-zinc-400">×</button></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Sesiones completadas" value={summary ? String(summary.completedSessions) : "Sin registros"} /><Metric label="Última sesión" value={relativeDate(summary?.latestSessionDate ?? "")} /><Metric label="Duración promedio" value={summary?.averageDurationMinutes ? `${summary.averageDurationMinutes} min` : "Sin registros"} /><Metric label="Progreso general" value={typeof summary?.progressPercentage === "number" ? `${summary.progressPercentage}%` : "Sin métrica válida"} /></div>
    <section className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold">Progreso reciente</p><span className="text-[10px] text-zinc-500">4 semanas</span></div>{summary?.recentWeeklySessions.some(Boolean) ? <Trend values={summary.recentWeeklySessions} /> : <p className="py-7 text-center text-xs text-zinc-500">Todavía no hay suficiente historial.</p>}</section>
    {summary?.latestPainReport && <section className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-100"><p className="text-xs font-black">⚠ Molestia reportada</p><p className="mt-1 text-[10px] text-red-200/70">{showDate(summary.latestPainReport.date)}</p><p className="mt-2 line-clamp-3 text-xs">{summary.latestPainReport.details || "Sin detalle informado."}</p></section>}
    <button type="button" onClick={tracking} className="mt-5 min-h-11 w-full rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950">Abrir seguimiento completo</button>
  </aside>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-black/25 p-3"><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-sm font-bold text-zinc-100">{value}</p></div>; }

function DeleteDialog({ routine, busy, cancel, confirm }: { routine: TrainingRoutine; busy: boolean; cancel: () => void; confirm: () => void }) {
  const assigned = students(routine);
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) cancel(); }; document.addEventListener("keydown", listener); return () => document.removeEventListener("keydown", listener); }, [busy, cancel]);
  return <div className="fixed inset-0 z-[80] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) cancel(); }}><section role="dialog" aria-modal="true" aria-labelledby="delete-routine-title" className="w-full rounded-t-3xl border border-red-400/20 bg-[#121212] p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-300">Acción permanente</p><h2 id="delete-routine-title" className="mt-2 text-xl font-black">Eliminar rutina</h2><p className="mt-3 text-sm text-zinc-300">¿Querés eliminar “{routine.name}”?</p><p className="mt-2 text-sm leading-relaxed text-zinc-500">Se retirarán el plan editable y {assigned.length ? `${assigned.length} asignación${assigned.length === 1 ? "" : "es"}` : "sus asignaciones"}. Las sesiones realizadas, cargas, marcas, puntos y datos del alumno se conservarán mediante sus snapshots históricos.</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={cancel} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 disabled:opacity-50">Cancelar</button><button type="button" disabled={busy} onClick={confirm} className="min-h-11 rounded-xl border border-red-400/30 bg-red-400/10 px-4 text-sm font-black text-red-200 disabled:opacity-50">{busy ? "Eliminando…" : "Eliminar rutina"}</button></div></section></div>;
}

export function RoutineManagementPanel({ routines, mode, routineSection, ready, busyId, duplicatingId, actions }: { routines: TrainingRoutine[]; mode: Mode; routineSection?: RoutineStatusSection; ready: boolean; busyId: string; duplicatingId: string; actions: Actions }) {
  const [selectedId, setSelectedId] = useState(""); const [menuId, setMenuId] = useState(""); const [deleteTarget, setDeleteTarget] = useState<TrainingRoutine | null>(null); const [page, setPage] = useState(1);
  const pageSize = 10; const pages = Math.max(1, Math.ceil(routines.length / pageSize)); const currentPage = Math.min(page, pages); const visible = useMemo(() => routines.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, routines]);
  const selected = routines.find((routine) => routine.id === selectedId) ?? null;
  async function confirmDelete() { if (!deleteTarget || busyId) return; const removed = await actions.remove(deleteTarget); if (removed) { setSelectedId(""); setDeleteTarget(null); } }
  if (!ready) return <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">Cargando rutinas…</p>;
  if (!routines.length) {
    const emptyMessage = mode === "plantillas" ? "No hay plantillas que coincidan con los filtros." : routineSection === "activas" ? "No hay rutinas activas." : routineSection === "borradores" ? "No tenés borradores pendientes." : routineSection === "archivadas" ? "No hay rutinas archivadas." : "No hay rutinas que coincidan con los filtros.";
    return <p className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center text-zinc-500">{emptyMessage}</p>;
  }
  return <div className={`grid min-w-0 gap-3 ${selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
    <section className="min-w-0 overflow-visible rounded-2xl border border-white/[.07] bg-[#111]">
      <div className="hidden grid-cols-[minmax(140px,1.35fr)_minmax(110px,.9fr)_minmax(85px,.7fr)_70px_80px_90px_75px_112px] gap-3 border-b border-zinc-800 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 lg:grid"><span>{mode === "plantillas" ? "Plantilla" : "Rutina"}</span><span>Alumno</span><span>Objetivo</span><span>Estado</span><span>Volumen</span><span>Última sesión</span><span>Progreso</span><span className="text-right">Acciones</span></div>
      <div className="divide-y divide-zinc-800/80">{visible.map((routine) => <RoutineRow key={routine.id} routine={routine} mode={mode} selected={selectedId === routine.id} menuOpen={menuId === routine.id} busy={busyId === routine.id} duplicating={duplicatingId === routine.id} select={() => setSelectedId(routine.id)} toggleMenu={() => setMenuId((value) => value === routine.id ? "" : routine.id)} requestDelete={() => { setMenuId(""); setDeleteTarget(routine); }} actions={actions} />)}</div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500"><span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, routines.length)} de {routines.length}</span><div className="flex items-center gap-1"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="size-9 rounded-lg border border-zinc-800 disabled:opacity-30">‹</button>{Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map((value) => <button type="button" key={value} onClick={() => setPage(value)} className={`size-9 rounded-lg border ${value === currentPage ? "border-yellow-400/50 text-yellow-300" : "border-zinc-800"}`}>{value}</button>)}<button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="size-9 rounded-lg border border-zinc-800 disabled:opacity-30">›</button></div></footer>
    </section>
    {selected && <div className="hidden xl:block"><div className="sticky top-24"><Preview routine={selected} close={() => setSelectedId("")} tracking={() => actions.openTracking(selected)} /></div></div>}
    {selected && <div className="fixed inset-0 z-[65] overflow-y-auto bg-black/75 pt-16 xl:hidden" onPointerDown={(event) => event.target === event.currentTarget && setSelectedId("")}><div className="ml-auto min-h-full w-full max-w-sm"><Preview routine={selected} close={() => setSelectedId("")} tracking={() => actions.openTracking(selected)} /></div></div>}
    {deleteTarget && <DeleteDialog routine={deleteTarget} busy={busyId === deleteTarget.id} cancel={() => setDeleteTarget(null)} confirm={() => void confirmDelete()} />}
  </div>;
}

function RoutineRow({ routine, mode, selected, menuOpen, busy, duplicating, select, toggleMenu, requestDelete, actions }: { routine: TrainingRoutine; mode: Mode; selected: boolean; menuOpen: boolean; busy: boolean; duplicating: boolean; select: () => void; toggleMenu: () => void; requestDelete: () => void; actions: Actions }) {
  const summary = routine.managementSummary;
  return <article onClick={select} className={`relative transition hover:bg-white/[.025] ${selected ? "bg-yellow-400/[.045] shadow-[inset_3px_0_0_#facc15]" : ""}`}>
    <div className="hidden min-h-[78px] grid-cols-[minmax(140px,1.35fr)_minmax(110px,.9fr)_minmax(85px,.7fr)_70px_80px_90px_75px_112px] items-center gap-3 px-4 py-3 lg:grid"><Name primary={mode === "asignaciones" ? studentNames(routine) : routine.name} secondary={mode === "asignaciones" ? routine.name : `ID: ${routine.id.slice(-10).toUpperCase()}`} /><span className="truncate text-xs text-zinc-300">{mode === "asignaciones" ? routine.name : studentNames(routine)}</span><span className="truncate text-xs text-zinc-400">{routine.objective || "Sin definir"}</span><StatusBadge routine={routine} /><span className="text-xs text-zinc-300">{routine.days.length} días<br/><span className="text-zinc-500">{exerciseCount(routine)} ejercicios</span></span><span className="text-xs text-zinc-300">{showDate(summary?.latestSessionDate ?? "")}<br/><span className="text-zinc-500">{relativeDate(summary?.latestSessionDate ?? "")}</span></span><Progress routine={routine} /><VisibleActions routine={routine} mode={mode} menuOpen={menuOpen} busy={busy} duplicating={duplicating} toggleMenu={toggleMenu} requestDelete={requestDelete} actions={actions} /></div>
    <div className="p-4 lg:hidden"><div className="flex items-start justify-between gap-3"><Name primary={mode === "asignaciones" ? studentNames(routine) : routine.name} secondary={mode === "asignaciones" ? routine.name : studentNames(routine)} /><StatusBadge routine={routine} /></div><p className="mt-3 text-xs text-zinc-400">{routine.objective} · {routine.days.length} días · {exerciseCount(routine)} ejercicios</p><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-[10px] text-zinc-500">Última sesión</p><p className="mt-1 text-xs text-zinc-300">{relativeDate(summary?.latestSessionDate ?? "")}</p></div><Progress routine={routine} /></div><div className="mt-4"><VisibleActions routine={routine} mode={mode} menuOpen={menuOpen} busy={busy} duplicating={duplicating} toggleMenu={toggleMenu} requestDelete={requestDelete} actions={actions} /></div></div>
  </article>;
}

function Name({ primary, secondary }: { primary: string; secondary: string }) { return <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-yellow-400/20 bg-yellow-400/[.06] text-sm text-yellow-300">↔</span><span className="min-w-0"><strong className="block truncate text-sm text-zinc-100">{primary}</strong><span className="mt-1 block truncate text-[10px] text-zinc-500">{secondary}</span></span></div>; }

function VisibleActions({ routine, mode, menuOpen, busy, duplicating, toggleMenu, requestDelete, actions }: { routine: TrainingRoutine; mode: Mode; menuOpen: boolean; busy: boolean; duplicating: boolean; toggleMenu: () => void; requestDelete: () => void; actions: Actions }) {
  const isDraft = mode !== "plantillas" && routine.status === "borrador";
  const reusableCompleteClass = mode === "plantillas" && routine.days.length === 1;
  const primaryLabel = mode === "plantillas" ? reusableCompleteClass ? "Usar como base" : "Usar plantilla" : isDraft ? "Continuar editando" : "Abrir plan";
  const primaryAction = mode === "plantillas" ? reusableCompleteClass ? () => actions.useAsBase(routine) : () => actions.useTemplate(routine) : isDraft ? () => actions.edit(routine) : () => actions.openPlan(routine);
  return <div className="relative flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}><button type="button" onClick={primaryAction} className="min-h-9 rounded-lg border border-yellow-400/30 px-3 text-xs font-bold text-zinc-100">{primaryLabel}</button>{routine.kind === "assigned" && <button type="button" onClick={() => actions.openTracking(routine)} aria-label="Abrir seguimiento" className="grid size-9 place-items-center rounded-lg border border-zinc-700 text-yellow-300">↗</button>}<button type="button" onClick={toggleMenu} aria-label="Más acciones" aria-expanded={menuOpen} className="grid size-9 place-items-center rounded-lg border border-zinc-700 text-lg text-zinc-300">⋮</button>{menuOpen && <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-zinc-700 bg-[#171717] p-1 text-left text-xs shadow-2xl"><MenuItem label="Editar" disabled={routine.status === "archivada"} action={() => actions.edit(routine)} />{!reusableCompleteClass && <MenuItem label={duplicating ? "Duplicando…" : "Duplicar"} disabled={duplicating} action={() => actions.duplicate(routine)} />}{routine.kind === "assigned" && <><MenuItem label="Usar como plantilla" action={() => actions.saveAsTemplate(routine)} />{routine.status !== "archivada" && <MenuItem label="Asignar alumnos" action={() => actions.manageAssignments(routine)} />}</>}<MenuItem label="Historial de versiones" action={() => actions.history(routine)} />{routine.status === "archivada" ? <MenuItem label="Restaurar" disabled={busy} action={() => actions.restore(routine)} /> : <MenuItem label="Archivar" disabled={busy} action={() => actions.archive(routine)} />}<div className="my-1 border-t border-zinc-800"/><MenuItem label="Eliminar rutina" danger disabled={busy} action={requestDelete} /></div>}</div>;
}

function MenuItem({ label, action, disabled = false, danger = false }: { label: string; action: () => void; disabled?: boolean; danger?: boolean }) { return <button type="button" disabled={disabled} onClick={action} className={`min-h-10 w-full rounded-lg px-3 text-left font-semibold disabled:opacity-40 ${danger ? "text-red-300 hover:bg-red-400/10" : "text-zinc-300 hover:bg-zinc-800"}`}>{label}</button>; }
