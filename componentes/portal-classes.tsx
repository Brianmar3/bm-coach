"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClassStrengthLogEditor, type ClassStrengthEditorValue } from "@/componentes/class-strength-log-editor";
import type { ClassStrengthExerciseLog, PortalClassOccurrence } from "@/types/classes";
import type { PortalAchievement } from "@/lib/portal-achievements";

type ClassHistory = {
  id: string;
  occurrenceId: string;
  date: string;
  name: string;
  startTime: string;
  attendanceResponse: "GOING" | "NOT_GOING" | null;
  actualAttendance: "UNKNOWN" | "PRESENT" | "ABSENT" | "CANCELLED";
  strengthBlockName: string;
  notes: string;
  status: "DRAFT" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  exercises: ClassStrengthExerciseLog[];
};
type EditingStrength = { occurrenceId: string; title: string; value: ClassStrengthEditorValue };
type ClassData = {
  occurrences: PortalClassOccurrence[];
  history: ClassHistory[];
};

const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const argentinaToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const bestWeight = (exercise: ClassStrengthExerciseLog) => {
  const values = exercise.sets.flatMap((set) => set.weight === null ? [] : [set.weight]);
  return values.length ? Math.max(...values) : null;
};
function previousClassResult(history: ClassHistory[], currentIndex: number, exerciseName: string) {
  const normalized = exerciseName.trim().toLocaleLowerCase("es");
  for (let index = currentIndex + 1; index < history.length; index += 1) {
    const exercise = history[index].exercises.find((item) => item.exerciseName.trim().toLocaleLowerCase("es") === normalized);
    if (exercise) {
      const weight = bestWeight(exercise);
      if (weight !== null) return { weight, date: history[index].date };
    }
  }
  return null;
}

function attendanceLabel(log: ClassHistory) {
  if (log.actualAttendance === "PRESENT") return "Presente";
  if (log.actualAttendance === "ABSENT") return "Ausente";
  if (log.actualAttendance === "CANCELLED") return "Cancelada";
  if (log.attendanceResponse === "GOING") return "Asistencia confirmada";
  if (log.attendanceResponse === "NOT_GOING") return "No asistió";
  return "Sin registro de asistencia";
}

export function PortalClasses({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [editing, setEditing] = useState<EditingStrength | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  const endpoint = compact ? "/api/portal/clases?summary=1" : "/api/portal/clases";

  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json() as ClassData & { error?: string };
    if (response.status === 401) { window.location.href = "/portal/login"; return; }
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
    setData(body);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as ClassData & { error?: string };
        if (response.status === 401) { window.location.href = "/portal/login"; return null; }
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
        return body;
      })
      .then((body) => { if (body) setData(body); })
      .catch((value: unknown) => { if (value instanceof Error && value.name !== "AbortError") setError(value.message); });
    return () => controller.abort();
  }, [endpoint]);

  async function respond(item: PortalClassOccurrence, value: "GOING" | "NOT_GOING") {
    setSavingId(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/portal/clases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId: item.id, response: value }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setNotice(body.message ?? "Respuesta guardada."); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setSavingId(""); }
  }

  function editOccurrence(item: PortalClassOccurrence) {
    const exercises = item.workoutLog?.exercises ?? item.strengthBlock?.exercises.map((exercise) => ({
      exerciseName: exercise.exerciseName,
      order: exercise.order,
      notes: "",
      sets: Array.from({ length: exercise.suggestedSets }, (_, index) => ({ setNumber: index + 1, weight: null, repetitions: null, effort: null, unit: "kg", notes: "" })),
    })) ?? [];
    setEditing({ occurrenceId: item.id, title: item.name, value: { id: item.workoutLog?.id, notes: item.workoutLog?.notes ?? "", exercises } });
  }

  function editHistory(log: ClassHistory) {
    setEditing({ occurrenceId: log.occurrenceId, title: log.name, value: { id: log.id, notes: log.notes, exercises: log.exercises } });
  }

  async function deleteHistory(log: ClassHistory) {
    if (!window.confirm("¿Eliminar este bloque de fuerza? Esta acción no se puede deshacer.")) return;
    setSavingId(log.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/portal/clases/fuerza", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: log.id }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar. Intentá nuevamente.");
      setNotice(body.message ?? "Bloque eliminado correctamente.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar. Intentá nuevamente."); }
    finally { setSavingId(""); }
  }

  async function saveStrength(status: "DRAFT" | "COMPLETED", value: ClassStrengthEditorValue) {
    if (!editing) return;
    const response = await fetch("/api/portal/clases/fuerza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: value.id, occurrenceId: editing.occurrenceId, status, notes: value.notes, exercises: value.exercises }) });
    const body = await response.json() as { error?: string; message?: string; achievements?: PortalAchievement[] };
    if (!response.ok) throw new Error(body.error ?? "No se pudo guardar. Tus cambios permanecen en pantalla.");
    const achievementMessage = body.achievements?.[0]
      ? ` ${body.achievements[0].name}${body.achievements[0].exercise ? ` en ${body.achievements[0].exercise}` : ""}.`
      : "";
    setNotice(`${body.message ?? "Registro guardado."}${achievementMessage}`);
    setEditing(null);
    await load();
  }

  const today = argentinaToday();
  const todayItems = useMemo(() => (data?.occurrences ?? [])
    .filter((item) => item.date === today)
    .sort((left, right) => {
      const leftUpcoming = left.status === "SCHEDULED" && left.canRespond;
      const rightUpcoming = right.status === "SCHEDULED" && right.canRespond;
      return Number(rightUpcoming) - Number(leftUpcoming) || left.startTime.localeCompare(right.startTime);
    }), [data, today]);
  const weekEnd = addDays(today, 6);
  const grouped = useMemo(() => {
    const map = new Map<string, PortalClassOccurrence[]>();
    const visible = showWeek
      ? (data?.occurrences ?? []).filter((item) => item.date >= today && item.date <= weekEnd)
      : todayItems;
    for (const item of visible) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()];
  }, [data, showWeek, today, todayItems, weekEnd]);
  if (!data && !error) return <div className="h-36 animate-pulse rounded-2xl bg-zinc-900" />;
  if (compact) return <section className="rounded-2xl border border-yellow-400/20 bg-zinc-900 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Clases de hoy</p><h2 className="mt-1 text-lg font-bold">{todayItems.length ? `${todayItems.length} ${todayItems.length === 1 ? "clase disponible" : "clases disponibles"}` : "Sin clases presenciales"}</h2></div><Link href="/portal/clases" className="shrink-0 text-sm font-bold text-yellow-400">Ver horarios →</Link></div>
    {todayItems.length ? <div className="mt-3 space-y-3">{todayItems.slice(0, 2).map((item) => <article key={item.id} className="rounded-xl bg-zinc-950 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-zinc-400">Hoy · {item.startTime} · {item.category}</p></div><span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">{item.statusLabel}</span></div><p className="mt-2 text-xs text-zinc-500">{item.response === "GOING" ? "Confirmaste que asistirás" : item.response === "NOT_GOING" ? "Indicaste que no asistirás" : "Todavía no respondiste"}</p>{item.canRespond && <ResponseButtons item={item} saving={savingId === item.id} respond={respond} />}</article>)}</div> : <p className="mt-3 text-sm text-zinc-500">Hoy no hay clases programadas.</p>}
    <Feedback error={error} notice={notice} />
  </section>;

  return <div>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-yellow-400">Agenda presencial</p><h1 className="mt-1 text-2xl font-bold">{showWeek ? "Semana completa" : "Clases de hoy"}</h1><p className="mt-2 text-sm text-zinc-500">Confirmá tu lugar y registrá el bloque de fuerza después de la clase.</p></div><button onClick={() => setShowWeek((value) => !value)} className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-300 sm:self-auto">{showWeek ? "Ver solo hoy" : "Ver semana completa"}</button></header>
    <Feedback error={error} notice={notice} />
    {!showWeek && todayItems.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Hoy no hay clases programadas.</p>}
    <div className="mt-6 space-y-5">{grouped.map(([date, items]) => <section key={date}><h2 className="mb-3 capitalize font-bold text-yellow-300">{dateLabel(date)}</h2><div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-sm text-zinc-400">{item.startTime}–{item.endTime} · {item.category}</p></div><span className="rounded-full bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{item.statusLabel}</span></div><p className="mt-3 text-xs text-zinc-500">{item.confirmedCount} confirmados{item.capacity === null ? "" : ` · cupo ${item.capacity}`}</p>{item.canRespond && <ResponseButtons item={item} saving={savingId === item.id} respond={respond} />}{item.strengthAvailable && <button onClick={() => editOccurrence(item)} className="mt-3 w-full rounded-xl border border-yellow-400/40 p-3 font-bold text-yellow-300">{item.workoutLog ? "Editar bloque de fuerza" : "Registrar bloque de fuerza"}</button>}</article>)}</div></section>)}</div>
    <section id="historial-clases" className="mt-8 scroll-mt-24"><p className="text-xs uppercase tracking-wider text-yellow-400">Registro de clase presencial</p><h2 className="mt-1 text-xl font-bold">Historial de clases</h2>{data?.history.length ? <div className="mt-4 space-y-3">{data.history.map((log, logIndex) => <details key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{log.name}</p><p className="mt-1 text-xs text-zinc-400">{dateLabel(log.date)} · {log.startTime} · {attendanceLabel(log)}</p><p className="mt-2 text-xs text-zinc-500">{log.strengthBlockName || "Bloque de fuerza registrado"} · {log.exercises.length} ejercicios</p></div><span className="text-sm font-bold text-yellow-400">Ver detalle</span></div></summary><div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">{log.exercises.map((exercise) => { const current = bestWeight(exercise); const previous = previousClassResult(data.history, logIndex, exercise.exerciseName); const difference = current !== null && previous ? current - previous.weight : null; return <div key={`${log.id}-${exercise.order}`} className="rounded-xl bg-zinc-950 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{exercise.exerciseName}</p>{previous && <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">Anterior {previous.weight} kg · {difference === null ? "sin comparación" : `${difference > 0 ? "↑ +" : difference < 0 ? "↓ " : ""}${difference} kg`}</span>}</div><p className="mt-1 text-sm text-zinc-400">{exercise.sets.map((set) => `${set.weight ?? "—"} kg × ${set.repetitions ?? "—"}${set.effort === null ? "" : ` · RIR ${set.effort}`}`).join(" · ")}</p>{exercise.notes && <p className="mt-2 text-xs text-zinc-500">{exercise.notes}</p>}{!previous && <p className="mt-2 text-xs text-zinc-600">Primer registro de este ejercicio en clases.</p>}</div>; })}{log.notes && <p className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-400">{log.notes}</p>}<div className="flex flex-wrap justify-end gap-2 pt-2"><button type="button" onClick={() => editHistory(log)} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300">Editar</button><button type="button" disabled={savingId === log.id} onClick={() => deleteHistory(log)} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300 disabled:opacity-50">{savingId === log.id ? "Eliminando…" : "Eliminar"}</button></div></div></details>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">Todavía no hay clases registradas.</p>}</section>
    {editing && <ClassStrengthLogEditor title={editing.title} initialValue={editing.value} close={() => setEditing(null)} save={saveStrength} />}
  </div>;
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return <p className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>;
}

function ResponseButtons({ item, saving, respond }: { item: PortalClassOccurrence; saving: boolean; respond: (item: PortalClassOccurrence, value: "GOING" | "NOT_GOING") => void }) {
  return <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => respond(item, "GOING")} className={`rounded-xl p-3 font-bold text-zinc-950 ${item.response === "GOING" ? "bg-emerald-400" : "bg-yellow-400"}`}>Asistiré</button><button disabled={saving} onClick={() => respond(item, "NOT_GOING")} className={`rounded-xl border p-3 font-semibold ${item.response === "NOT_GOING" ? "border-red-300 text-red-200" : "border-zinc-700"}`}>No asistiré</button></div>;
}
