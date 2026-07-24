"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActualClassAttendance, AdminClassOccurrence } from "@/types/classes";

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

export function ClassOccurrenceAdmin() {
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState<AdminClassOccurrence[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [manualStudentId, setManualStudentId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/clases/ocurrencias?date=${date}`, { cache: "no-store" });
      const body = await response.json() as AdminClassOccurrence[] & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
      setItems(body);
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudieron cargar las clases."); } finally { setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clases/ocurrencias?date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as AdminClassOccurrence[] & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
        return body;
      })
      .then((body) => { setItems(body); setLoading(false); })
      .catch((value: unknown) => { if (value instanceof Error && value.name !== "AbortError") { setError(value.message); setLoading(false); } });
    return () => controller.abort();
  }, [date]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/alumnos", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Array<{ id: string; firstName: string; lastName: string }>> : [])
      .then(setAvailableStudents)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function patch(payload: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/clases/ocurrencias/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo actualizar.");
      setNotice(body.message ?? "Clase actualizada."); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo actualizar."); } finally { setSaving(false); }
  }

  return <section className="mb-7 rounded-2xl border border-zinc-800 bg-zinc-900">
    <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Ocurrencias concretas</p><h2 className="mt-1 text-lg font-bold">{date === todayKey() ? "Clases hoy" : "Clases del día"}</h2><p className="mt-1 text-xs text-zinc-500">La confirmación y la asistencia real se muestran por separado.</p></div><input type="date" value={date} onChange={(event) => { setLoading(true); setDate(event.target.value); }} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2" /></div>
    {(error || notice) && <p className={`m-4 rounded-xl p-3 text-sm ${error ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>}
    {loading ? <p className="p-8 text-center text-zinc-500">Cargando clases…</p> : items.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <OccurrenceCard key={item.id} item={item} open={() => setSelectedId(item.id)} />)}</div> : <p className="p-8 text-center text-zinc-500">No hay clases programadas para esta fecha.</p>}
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-3"><section className="mx-auto my-4 max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-yellow-400">{selected.date} · {selected.startTime}</p><h2 className="text-2xl font-bold">{selected.name}</h2><p className="mt-1 text-zinc-400">{selected.statusLabel} · cupo {selected.capacity ?? "sin límite"}</p></div><button onClick={() => setSelectedId("")}>Cerrar</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><StudentGroup title="Asistirán" students={selected.students.filter((student) => student.response === "GOING")} /><StudentGroup title="No asistirán" students={selected.students.filter((student) => student.response === "NOT_GOING")} /><StudentGroup title="Sin respuesta" students={selected.noResponse} /></div>
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-zinc-800 p-3 sm:flex-row"><select value={manualStudentId} onChange={(event) => setManualStudentId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-3"><option value="">Agregar alumno manualmente…</option>{availableStudents.filter((student) => !selected.students.some((item) => item.id === student.id)).map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select><button disabled={saving || !manualStudentId} onClick={async () => { await patch({ action: "attendance", studentId: manualStudentId, actualAttendance: "UNKNOWN", response: "GOING" }); setManualStudentId(""); }} className="rounded-lg bg-yellow-400 px-4 py-3 font-bold text-zinc-950">Agregar</button></div>
      <section className="mt-5"><h3 className="font-bold">Asistencia real</h3><div className="mt-3 space-y-2">{selected.students.map((student) => <div key={student.id} className="flex flex-col gap-2 rounded-xl bg-zinc-950 p-3 sm:flex-row sm:items-center sm:justify-between"><span>{student.name}<small className="ml-2 text-zinc-500">{student.response === "GOING" ? "Confirmó" : student.response === "NOT_GOING" ? "Canceló" : "Sin respuesta"}</small></span><div className="flex gap-2"><select disabled={saving} value={student.actualAttendance} onChange={(event) => patch({ action: "attendance", studentId: student.id, actualAttendance: event.target.value as ActualClassAttendance })} className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"><option value="UNKNOWN">Sin marcar</option><option value="PRESENT">Asistió</option><option value="ABSENT">Faltó</option><option value="CANCELLED">Canceló</option></select>{student.response && <button disabled={saving} onClick={() => patch({ action: "remove-response", studentId: student.id })} className="rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400">Quitar confirmación</button>}</div></div>)}</div></section>
      <OccurrenceSettings occurrence={selected} saving={saving} patch={patch} />
      <StrengthBlockEditor occurrence={selected} saving={saving} save={(block) => patch({ action: "strength-block", block })} />
    </section></div>}
  </section>;
}

function OccurrenceCard({ item, open }: { item: AdminClassOccurrence; open: () => void }) {
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-yellow-400/50">
    <button onClick={open} className="w-full text-left"><div className="flex justify-between gap-3"><div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-zinc-400">{item.startTime}–{item.endTime}</p></div><span className="text-xs text-zinc-500">{item.statusLabel}</span></div><p className="mt-4 text-sm text-emerald-300">{item.confirmedCount} confirmados</p><p className="mt-1 text-xs text-zinc-500">{item.capacity === null ? "Sin límite" : `${Math.max(item.capacity - item.confirmedCount, 0)} lugares disponibles`} · {item.noResponse.length} sin respuesta</p><div className="mt-3 flex flex-wrap gap-1">{item.students.filter((student) => student.response === "GOING").slice(0, 4).map((student) => <span key={student.id} className="rounded-full bg-zinc-900 px-2 py-1 text-xs">{student.name}</span>)}</div><p className="mt-4 text-sm font-bold text-yellow-400">Ver detalle →</p></button>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3">{item.scheduleId ? <Link href={`/asistencias?scheduleId=${encodeURIComponent(item.scheduleId)}&date=${item.date}`} className="rounded-lg bg-emerald-400 px-3 py-2.5 text-center text-xs font-bold text-zinc-950">Tomar asistencia</Link> : <span className="rounded-lg border border-zinc-800 px-3 py-2.5 text-center text-xs text-zinc-600">Sin horario asociado</span>}<Link href={`/asistencias?date=${item.date}`} className="rounded-lg border border-zinc-700 px-3 py-2.5 text-center text-xs font-semibold text-zinc-300">Ver historial</Link></div>
  </article>;
}

function StudentGroup({ title, students }: { title: string; students: AdminClassOccurrence["students"] }) {
  return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs uppercase text-zinc-500">{title} · {students.length}</p><div className="mt-2 space-y-1">{students.length ? students.map((student) => <p key={student.id} className="text-sm">{student.name}</p>) : <p className="text-sm text-zinc-600">Ninguno</p>}</div></div>;
}

function OccurrenceSettings({ occurrence, saving, patch }: { occurrence: AdminClassOccurrence; saving: boolean; patch: (payload: Record<string, unknown>) => Promise<void> }) {
  const [startTime, setStartTime] = useState(occurrence.startTime);
  const [endTime, setEndTime] = useState(occurrence.endTime);
  const [capacity, setCapacity] = useState(occurrence.capacity === null ? "" : String(occurrence.capacity));
  const [notes, setNotes] = useState(occurrence.internalNotes);
  return <details className="mt-5 rounded-xl border border-zinc-800 p-4"><summary className="cursor-pointer font-bold">Acciones y configuración puntual</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Inicio<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /></label><label className="text-sm">Fin<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /></label><label className="text-sm sm:col-span-2">Cupo para esta fecha<input type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Sin límite" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /></label><label className="text-sm sm:col-span-2">Observaciones internas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" /></label><button disabled={saving || endTime <= startTime} onClick={() => patch({ startTime, endTime, capacity: capacity ? Number(capacity) : null, internalNotes: notes })} className="rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950 sm:col-span-2">Guardar cambios puntuales</button><button disabled={saving || occurrence.status === "CANCELLED"} onClick={() => confirm("¿Cancelar solamente esta fecha?") && patch({ status: "CANCELLED" })} className="rounded-xl border border-red-400/30 p-3 font-semibold text-red-300">Cancelar fecha</button><button disabled={saving} onClick={() => patch({ status: "COMPLETED" })} className="rounded-xl border border-zinc-700 p-3 font-semibold">Cerrar clase</button><button disabled={saving} onClick={() => patch({ strengthEnabled: !occurrence.strengthEnabled })} className="rounded-xl border border-yellow-400/40 p-3 font-bold text-yellow-300 sm:col-span-2">{occurrence.strengthEnabled ? "Deshabilitar registro de fuerza" : "Habilitar registro de fuerza"}</button></div></details>;
}

function StrengthBlockEditor({ occurrence, saving, save }: { occurrence: AdminClassOccurrence; saving: boolean; save: (block: unknown) => void }) {
  const [name, setName] = useState(occurrence.strengthBlock?.name ?? "Bloque de fuerza");
  const [notes, setNotes] = useState(occurrence.strengthBlock?.notes ?? "");
  const [exercises, setExercises] = useState(occurrence.strengthBlock?.exercises ?? []);
  return <details className="mt-6 rounded-xl border border-zinc-800 p-4"><summary className="cursor-pointer font-bold text-yellow-300">Configurar bloque de fuerza</summary><div className="mt-4 space-y-3"><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" placeholder="Nombre del bloque" />{exercises.map((exercise, index) => <div key={`${exercise.id}-${index}`} className="grid gap-2 rounded-xl bg-zinc-950 p-3 sm:grid-cols-[1fr_7rem_8rem]"><input value={exercise.exerciseName} onChange={(event) => { const next = [...exercises]; next[index] = { ...exercise, exerciseName: event.target.value }; setExercises(next); }} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2" placeholder="Ejercicio" /><input type="number" min="1" value={exercise.suggestedSets} onChange={(event) => { const next = [...exercises]; next[index] = { ...exercise, suggestedSets: Number(event.target.value) }; setExercises(next); }} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2" /><input value={exercise.suggestedReps} onChange={(event) => { const next = [...exercises]; next[index] = { ...exercise, suggestedReps: event.target.value }; setExercises(next); }} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2" placeholder="Reps" /></div>)}<button onClick={() => setExercises([...exercises, { id: `new-${exercises.length}`, exerciseName: "", order: exercises.length + 1, suggestedSets: 3, suggestedReps: "10", instructions: "" }])} className="w-full rounded-xl border border-dashed border-zinc-700 p-3 text-yellow-400">+ Agregar ejercicio</button><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3" placeholder="Observaciones" /><button disabled={saving} onClick={() => save({ name, notes, exercises })} className="w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950">Guardar y habilitar</button></div></details>;
}
