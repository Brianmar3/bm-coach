"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DuplicateRoutineCandidate, DuplicateRoutineGroup } from "@/lib/routine-duplicates";
import type { TrainingRoutine } from "@/types/gestion";

type Props = {
  close: () => void;
  onDeleted: (ids: string[]) => void;
  onArchived: (routine: TrainingRoutine) => void;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function statusLabel(value: DuplicateRoutineCandidate["status"]) {
  return ({ ACTIVA: "Activa", BORRADOR: "Borrador", FINALIZADA: "Finalizada", ARCHIVADA: "Archivada" })[value];
}

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export function RoutineDuplicatesReview({ close, onDeleted, onArchived }: Props) {
  const [groups, setGroups] = useState<DuplicateRoutineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [principal, setPrincipal] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [pendingDelete, setPendingDelete] = useState<{ group: DuplicateRoutineGroup; ids: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/rutinas/duplicados", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudieron revisar los posibles duplicados."));
      const result = await response.json() as { groups: DuplicateRoutineGroup[] };
      setGroups(result.groups);
      setSelected({});
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No se pudieron revisar los posibles duplicados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rutinas/duplicados", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response, "No se pudieron revisar los posibles duplicados."));
      return response.json() as Promise<{ groups: DuplicateRoutineGroup[] }>;
    }).then((result) => setGroups(result.groups)).catch((loadError: unknown) => {
      if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const routineCount = useMemo(() => groups.reduce((total, group) => total + group.routines.length, 0), [groups]);

  async function deleteSafeRoutines() {
    if (!pendingDelete || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/rutinas/duplicados", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routineIds: pendingDelete.ids }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudieron eliminar las rutinas."));
      const result = await response.json() as { deletedIds: string[]; message: string };
      onDeleted(result.deletedIds);
      setNotice(result.message);
      setPendingDelete(null);
      await load();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudieron eliminar las rutinas."); setPendingDelete(null); }
    finally { setBusy(false); }
  }

  async function archive(routine: DuplicateRoutineCandidate) {
    if (busy || !window.confirm(`¿Archivar “${routine.name}”? Se conservarán todos sus datos e historial.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo archivar la rutina."));
      const result = await response.json() as { routine: TrainingRoutine; message: string };
      onArchived(result.routine);
      setNotice(result.message);
      await load();
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "No se pudo archivar la rutina."); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[80] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="duplicate-review-title" className="flex max-h-[94dvh] w-full flex-col rounded-t-3xl border border-zinc-700 bg-[#111] text-white shadow-2xl sm:max-w-6xl sm:rounded-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5 sm:p-6">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-yellow-400">Rutinas · revisión segura</p><h2 id="duplicate-review-title" className="mt-1 text-2xl font-black">Posibles duplicados</h2><p className="mt-1 max-w-3xl text-sm text-zinc-400">Coincidencias conservadoras por nombre normalizado, objetivo y estructura exacta. Nada se combina ni se elimina automáticamente.</p></div>
        <button type="button" onClick={close} disabled={busy} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-sm text-zinc-300 disabled:opacity-50">Cerrar</button>
      </header>
      <div className="overflow-y-auto p-4 sm:p-6">
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] p-3 text-sm text-emerald-200">{notice}</p>}
        {loading ? <p className="rounded-2xl border border-zinc-800 p-8 text-center text-sm text-zinc-400">Revisando rutinas y relaciones históricas…</p> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center"><p className="font-bold">No encontramos posibles duplicados.</p><p className="mt-1 text-sm text-zinc-500">Las rutinas nuevas ya utilizan el flujo corregido de asignación.</p></div> : <>
          <p className="mb-4 text-sm text-zinc-400">{groups.length} grupo{groups.length === 1 ? "" : "s"} · {routineCount} rutinas para revisar</p>
          <div className="space-y-5">{groups.map((group, groupIndex) => {
            const checked = selected[group.id] ?? [];
            const principalId = principal[group.id] ?? group.routines[0].id;
            const safeIds = group.routines.filter((routine) => routine.safeToDelete && principalId !== routine.id).map((routine) => routine.id);
            return <article key={group.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
              <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[.15em] text-yellow-400/80">Grupo {groupIndex + 1}</p><h3 className="mt-1 text-lg font-black">{group.routines[0].name}</h3><p className="text-xs text-zinc-500">{group.objective} · {group.routines.length} coincidencias estructurales</p></div>
                {safeIds.length > 0 && <button type="button" disabled={!checked.length || busy} onClick={() => setPendingDelete({ group, ids: checked })} className="min-h-10 rounded-xl border border-red-400/25 px-3 text-sm font-bold text-red-300 disabled:opacity-40">Eliminar seleccionadas ({checked.length})</button>}
              </div>
              <div className="divide-y divide-zinc-800">{group.routines.map((routine) => {
                const isPrincipal = principalId === routine.id;
                const isChecked = checked.includes(routine.id);
                return <div key={routine.id} className={`p-4 ${isPrincipal ? "bg-yellow-400/[.045]" : ""}`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(15rem,.8fr)_auto] lg:items-start">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black">{routine.name}</p><span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">{statusLabel(routine.status)}</span>{isPrincipal && <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-bold text-yellow-300">{principal[group.id] ? "Principal elegida" : "Sugerida para conservar"}</span>}</div><p className="mt-1 text-xs text-zinc-500">ID {routine.id.slice(-8).toUpperCase()} · creada {dateLabel(routine.createdAt)} · actualizada {dateLabel(routine.updatedAt)}</p><p className="mt-2 text-sm text-zinc-300">{routine.dayCount} día{routine.dayCount === 1 ? "" : "s"} · {routine.blockCount} bloque{routine.blockCount === 1 ? "" : "s"} · {routine.exerciseCount} ejercicio{routine.exerciseCount === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-zinc-500">{routine.students.length ? routine.students.map((student) => `${student.name}${student.active ? " (activo)" : " (histórico)"}`).join(" · ") : "Sin alumnos asignados"}</p></div>
                    <div className="text-xs text-zinc-400"><p>{routine.sessionCount} sesiones · {routine.versionCount} versiones</p><p className="mt-1">Última sesión: {routine.lastSessionAt ? dateLabel(routine.lastSessionAt) : "sin registros"}</p><p className={`mt-2 font-bold ${routine.safeToDelete ? "text-emerald-300" : "text-orange-300"}`}>{routine.safeToDelete ? "Seguro para eliminar" : "Requiere revisión"}</p>{routine.riskReasons.length > 0 && <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-500">{routine.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>
                    <div className="flex flex-wrap gap-2 lg:max-w-56 lg:justify-end"><button type="button" onClick={() => { setPrincipal((current) => ({ ...current, [group.id]: routine.id })); setSelected((current) => ({ ...current, [group.id]: (current[group.id] ?? []).filter((id) => id !== routine.id) })); }} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300">Conservar esta</button>{routine.status !== "ARCHIVADA" && !routine.safeToDelete && <button type="button" disabled={busy} onClick={() => void archive(routine)} className="min-h-10 rounded-xl border border-orange-400/25 px-3 text-xs font-bold text-orange-300 disabled:opacity-50">Archivar</button>}{routine.safeToDelete && !isPrincipal && <><button type="button" disabled={busy} onClick={() => setPendingDelete({ group, ids: [routine.id] })} className="min-h-10 rounded-xl border border-red-400/25 px-3 text-xs font-bold text-red-300 disabled:opacity-50">Eliminar</button><label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-red-400/20 px-3 text-xs font-bold text-red-300"><input type="checkbox" checked={isChecked} onChange={() => setSelected((current) => ({ ...current, [group.id]: isChecked ? checked.filter((id) => id !== routine.id) : [...checked, routine.id] }))} /> Seleccionar</label></>}</div>
                  </div>
                </div>;
              })}</div>
            </article>;
          })}</div>
        </>}
      </div>
      {pendingDelete && <div className="border-t border-red-400/20 bg-red-400/[.06] p-4 sm:p-5"><p className="font-black text-red-200">Confirmar eliminación definitiva</p><p className="mt-1 text-sm text-zinc-300">Se eliminarán {pendingDelete.ids.length} rutina{pendingDelete.ids.length === 1 ? "" : "s"} vacía{pendingDelete.ids.length === 1 ? "" : "s"}. El servidor volverá a verificar todo; si apareció historial, la operación completa se cancela.</p><div className="mt-3 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setPendingDelete(null)} className="min-h-10 rounded-xl border border-zinc-700 px-4 text-sm font-bold">Cancelar</button><button type="button" disabled={busy} onClick={() => void deleteSafeRoutines()} className="min-h-10 rounded-xl bg-red-500 px-4 text-sm font-black text-white disabled:opacity-50">{busy ? "Verificando…" : "Eliminar definitivamente"}</button></div></div>}
    </section>
  </div>;
}
