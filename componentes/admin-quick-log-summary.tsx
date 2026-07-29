"use client";
/* eslint-disable @next/next/no-img-element -- validated Blob URLs */

import { useEffect, useState } from "react";
import type { QuickLog } from "@/types/quick-log";

const typeLabel = { WORKOUT: "Entrenamiento", NOTE: "Nota", PROGRESS: "Progreso", PHOTO: "Foto" } as const;

function isStrengthLog(log: QuickLog) {
  return log.type === "PROGRESS" && log.metricType === "carga" && log.sets !== null && log.repetitions !== null;
}

function strengthSummary(log: QuickLog) {
  if (!isStrengthLog(log)) return null;
  const unit = log.unit || "kg";
  const difference = log.previousValue !== null && log.currentValue !== null
    ? log.currentValue - log.previousValue
    : null;
  return {
    work: `${log.sets} × ${log.repetitions}`,
    load: `${log.currentValue?.toLocaleString("es-AR")} ${unit}`,
    previous: log.previousValue === null
      ? "Sin registro anterior"
      : `${log.previousValue.toLocaleString("es-AR")} ${unit}`,
    difference: difference === null
      ? ""
      : difference === 0
        ? "Sin cambios"
        : `${difference > 0 ? "+" : ""}${difference.toLocaleString("es-AR")} ${unit}`,
  };
}

export function AdminQuickLogSummary({ studentId }: { studentId: string }) {
  const [logs, setLogs] = useState<QuickLog[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [editing, setEditing] = useState<QuickLog | null>(null);
  async function load() { const response = await fetch(`/api/admin/alumnos/${studentId}/quick-logs`, { cache: "no-store" }); const body = await response.json() as { logs?: QuickLog[]; error?: string }; if (!response.ok) { setError(body.error ?? "No se pudo cargar el registro personal."); return; } setLogs(body.logs ?? []); }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/alumnos/${studentId}/quick-logs`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { logs?: QuickLog[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el registro personal.");
        setLogs(body.logs ?? []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof Error && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "No se pudo cargar el registro personal.");
      });
    return () => controller.abort();
  }, [studentId]);
  async function remove(log: QuickLog) { if (!window.confirm("¿Eliminar este registro personal? Esta acción no se puede deshacer.")) return; const response = await fetch(`/api/admin/alumnos/${studentId}/quick-logs`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: log.id }) }); const body = await response.json() as { error?: string; message?: string }; if (!response.ok) { setError(body.error ?? "No se pudo eliminar."); return; } setNotice(body.message ?? "Registro eliminado."); await load(); }
  return <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Registro personal</h3><p className="mt-1 text-xs text-zinc-500">{logs.length ? `${logs.length} registros` : "Sin registros"}</p></div><button onClick={() => setOpen((value) => !value)} className="text-sm font-bold text-yellow-400">{open ? "Ocultar" : "Ver historial completo"}</button></div>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}{notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}{!open && logs.slice(0, 3).map((log) => { const strength = strengthSummary(log); return <p key={log.id} className="mt-2 truncate text-sm text-zinc-400">{isStrengthLog(log) ? "Ejercicio" : typeLabel[log.type]} · {log.title || log.content || log.exerciseName}{strength ? ` · ${strength.work} · ${strength.load}` : ""}</p>; })}{open && <div className="mt-4 space-y-3">{logs.map((log) => { const strength = strengthSummary(log); return <article key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-yellow-300">{isStrengthLog(log) ? "Ejercicio" : typeLabel[log.type]} · {new Date(`${log.date}T12:00:00`).toLocaleDateString("es-AR")}</p><p className="mt-1 break-words font-semibold">{log.title || log.exerciseName || typeLabel[log.type]}</p></div><div className="flex shrink-0 gap-2 text-xs"><button onClick={() => setEditing(log)} className="text-yellow-300">Editar</button><button onClick={() => remove(log)} className="text-red-300">Eliminar</button></div></div>{strength && <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-black/55 p-2"><p className="text-[10px] uppercase text-zinc-500">Series × reps</p><p className="font-semibold">{strength.work}</p></div><div className="rounded-lg bg-black/55 p-2"><p className="text-[10px] uppercase text-zinc-500">Carga</p><p className="font-semibold text-yellow-300">{strength.load}</p></div><div className="col-span-2 rounded-lg bg-black/55 p-2"><p className="text-[10px] uppercase text-zinc-500">Evolución de carga</p><p className="text-sm">{strength.previous}{strength.difference ? ` · ${strength.difference}` : ""}</p></div></div>}{log.content && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{log.content}</p>}{log.hasPain && <p className="mt-2 text-xs text-red-300">Molestia: {log.painDetails || "Sin detalle"}</p>}{log.photos.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto">{log.photos.map((photo) => <img key={photo.id} src={photo.blobUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />)}</div>}</article>; })}</div>}
    {editing && <AdminEdit log={editing} studentId={studentId} close={() => setEditing(null)} saved={async () => { setEditing(null); setNotice("Registro actualizado correctamente."); await load(); }} />}
  </section>;
}

function AdminEdit({ log, studentId, close, saved }: { log: QuickLog; studentId: string; close: () => void; saved: () => Promise<void> }) {
  const [title, setTitle] = useState(log.title); const [content, setContent] = useState(log.content); const [category, setCategory] = useState(log.category); const [painDetails, setPainDetails] = useState(log.painDetails); const [saving, setSaving] = useState(false);
  async function submit() { setSaving(true); const response = await fetch(`/api/admin/alumnos/${studentId}/quick-logs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: log.id, title, content, category, painDetails }) }); if (response.ok) await saved(); setSaving(false); }
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 p-3"><div className="mx-auto my-8 max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex justify-between"><h3 className="font-bold">Editar registro personal</h3><button onClick={close}>Cerrar</button></div><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Categoría" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /><textarea value={painDetails} onChange={(event) => setPainDetails(event.target.value)} rows={2} placeholder="Molestias" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /><button disabled={saving} onClick={submit} className="mt-4 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950">{saving ? "Guardando…" : "Guardar cambios"}</button></div></div>;
}
