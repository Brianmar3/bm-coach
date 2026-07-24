"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClassStrengthExerciseLog, PortalClassOccurrence } from "@/types/classes";

type ClassHistory = { id: string; date: string; name: string; notes: string; exercises: ClassStrengthExerciseLog[] };
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

export function PortalClasses({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [editing, setEditing] = useState<PortalClassOccurrence | null>(null);
  const [showWeek, setShowWeek] = useState(false);

  async function load() {
    const response = await fetch("/api/portal/clases", { cache: "no-store" });
    const body = await response.json() as ClassData & { error?: string };
    if (response.status === 401) { window.location.href = "/portal/login"; return; }
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
    setData(body);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/clases", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as ClassData & { error?: string };
        if (response.status === 401) { window.location.href = "/portal/login"; return null; }
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las clases.");
        return body;
      })
      .then((body) => { if (body) setData(body); })
      .catch((value: unknown) => { if (value instanceof Error && value.name !== "AbortError") setError(value.message); });
    return () => controller.abort();
  }, []);

  async function respond(item: PortalClassOccurrence, value: "GOING" | "NOT_GOING") {
    setSavingId(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/portal/clases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId: item.id, response: value }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setNotice(body.message ?? "Respuesta guardada."); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setSavingId(""); }
  }

  const today = argentinaToday();
  const todayItems = useMemo(() => (data?.occurrences ?? [])
    .filter((item) => item.date === today)
    .sort((left, right) => {
      const leftUpcoming = left.status === "SCHEDULED" && left.canRespond;
      const rightUpcoming = right.status === "SCHEDULED" && right.canRespond;
      return Number(rightUpcoming) - Number(leftUpcoming) || left.startTime.localeCompare(right.startTime);
    }), [data, today]);
  const nextToday = todayItems.find((item) => item.status === "SCHEDULED" && item.canRespond);
  const next = nextToday ?? data?.occurrences.find((item) => item.date > today && item.status === "SCHEDULED" && item.canRespond);
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
  if (compact) return <section className="rounded-2xl border border-yellow-400/20 bg-zinc-900 p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Clases</p><h2 className="mt-1 text-lg font-bold">{next ? `${next.date === today ? "Próxima hoy" : "Próxima clase"}: ${next.name}` : "Sin clases próximas"}</h2></div><Link href="/portal/clases" className="text-sm font-bold text-yellow-400">Ver horarios →</Link></div>
    {next ? <><p className="mt-2 text-sm capitalize text-zinc-400">{next.date === today ? `Hoy · ${next.startTime}` : `${dateLabel(next.date)} · ${next.startTime}`}</p><p className="mt-1 text-xs text-zinc-500">{next.response === "GOING" ? "Asistiré" : next.response === "NOT_GOING" ? "No asistiré" : "Sin responder"}</p>{next.date === today && <ResponseButtons item={next} saving={savingId === next.id} respond={respond} />}</> : <p className="mt-3 text-sm text-zinc-500">Hoy no hay más clases programadas.</p>}
    <Feedback error={error} notice={notice} />
  </section>;

  return <div>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-yellow-400">Agenda presencial</p><h1 className="mt-1 text-2xl font-bold">{showWeek ? "Semana completa" : "Clases de hoy"}</h1><p className="mt-2 text-sm text-zinc-500">Confirmá tu lugar y registrá el bloque de fuerza después de la clase.</p></div><button onClick={() => setShowWeek((value) => !value)} className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-300 sm:self-auto">{showWeek ? "Ver solo hoy" : "Ver semana completa"}</button></header>
    <Feedback error={error} notice={notice} />
    {!showWeek && todayItems.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Hoy no hay clases programadas.</p>}
    <div className="mt-6 space-y-5">{grouped.map(([date, items]) => <section key={date}><h2 className="mb-3 capitalize font-bold text-yellow-300">{dateLabel(date)}</h2><div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-sm text-zinc-400">{item.startTime}–{item.endTime} · {item.category}</p></div><span className="rounded-full bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{item.statusLabel}</span></div><p className="mt-3 text-xs text-zinc-500">{item.confirmedCount} confirmados{item.capacity === null ? "" : ` · cupo ${item.capacity}`}</p>{item.canRespond && <ResponseButtons item={item} saving={savingId === item.id} respond={respond} />}{item.strengthAvailable && <button onClick={() => setEditing(item)} className="mt-3 w-full rounded-xl border border-yellow-400/40 p-3 font-bold text-yellow-300">Registrar bloque de fuerza</button>}</article>)}</div></section>)}</div>
    <section className="mt-8"><p className="text-xs uppercase tracking-wider text-yellow-400">Registro de clase presencial</p><h2 className="mt-1 text-xl font-bold">Historial de clases</h2>{data?.history.length ? <div className="mt-4 space-y-3">{data.history.map((log, logIndex) => <details key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><summary className="cursor-pointer font-bold">{log.name} · {dateLabel(log.date)}</summary><div className="mt-3 space-y-2">{log.exercises.map((exercise) => { const current = bestWeight(exercise); const previous = previousClassResult(data.history, logIndex, exercise.exerciseName); const difference = current !== null && previous ? current - previous.weight : null; return <div key={`${log.id}-${exercise.order}`} className="rounded-xl bg-zinc-950 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{exercise.exerciseName}</p>{previous && <span className={`rounded-full px-2 py-1 text-xs font-bold ${difference !== null && difference > 0 ? "bg-emerald-400/10 text-emerald-300" : difference !== null && difference < 0 ? "bg-red-400/10 text-red-300" : "bg-zinc-800 text-zinc-300"}`}>Anterior {previous.weight} kg · {difference === null ? "sin comparación" : `${difference > 0 ? "+" : ""}${difference} kg`}</span>}</div><p className="mt-1 text-sm text-zinc-400">{exercise.sets.map((set) => `${set.weight ?? "—"} kg × ${set.repetitions ?? "—"}`).join(" · ")}</p>{!previous && <p className="mt-2 text-xs text-zinc-600">Primer registro de este ejercicio en clases.</p>}</div>; })}</div></details>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">Todavía no hay registros de clases presenciales.</p>}</section>
    {editing && <StrengthEditor occurrence={editing} close={() => setEditing(null)} saved={async (message) => { setNotice(message); setEditing(null); await load(); }} />}
  </div>;
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return <p className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>;
}

function ResponseButtons({ item, saving, respond }: { item: PortalClassOccurrence; saving: boolean; respond: (item: PortalClassOccurrence, value: "GOING" | "NOT_GOING") => void }) {
  return <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => respond(item, "GOING")} className={`rounded-xl p-3 font-bold text-zinc-950 ${item.response === "GOING" ? "bg-emerald-400" : "bg-yellow-400"}`}>Asistiré</button><button disabled={saving} onClick={() => respond(item, "NOT_GOING")} className={`rounded-xl border p-3 font-semibold ${item.response === "NOT_GOING" ? "border-red-300 text-red-200" : "border-zinc-700"}`}>No asistiré</button></div>;
}

function StrengthEditor({ occurrence, close, saved }: { occurrence: PortalClassOccurrence; close: () => void; saved: (message: string) => Promise<void> }) {
  const initial = occurrence.workoutLog?.exercises ?? occurrence.strengthBlock?.exercises.map((item) => ({ exerciseName: item.exerciseName, order: item.order, notes: "", sets: Array.from({ length: item.suggestedSets }, (_, index) => ({ setNumber: index + 1, weight: null, repetitions: null, unit: "kg", notes: "" })) })) ?? [];
  const [exercises, setExercises] = useState<ClassStrengthExerciseLog[]>(initial);
  const [notes, setNotes] = useState(occurrence.workoutLog?.notes ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  function setResult(exerciseIndex: number, setIndex: number, key: "weight" | "repetitions", value: string) { const next = structuredClone(exercises); next[exerciseIndex].sets[setIndex][key] = value === "" ? null : Number(value); setExercises(next); }
  async function save(status: "DRAFT" | "COMPLETED") {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/portal/clases/fuerza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId: occurrence.id, status, notes, exercises }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      await saved(body.message ?? "Registro guardado.");
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-3"><section className="mx-auto my-4 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex justify-between gap-3"><div><p className="text-xs text-yellow-400">Registro de clase presencial</p><h2 className="text-xl font-bold">{occurrence.name}</h2></div><button onClick={close}>Cerrar</button></div>{error && <p className="mt-3 text-red-300">{error}</p>}<div className="mt-5 space-y-4">{exercises.map((exercise, exerciseIndex) => <article key={`${exercise.order}-${exerciseIndex}`} className="rounded-xl bg-zinc-950 p-4"><input value={exercise.exerciseName} onChange={(event) => { const next = [...exercises]; next[exerciseIndex] = { ...exercise, exerciseName: event.target.value }; setExercises(next); }} className="w-full bg-transparent font-bold outline-none" placeholder="Ejercicio" /><div className="mt-3 space-y-2">{exercise.sets.map((set, setIndex) => <div key={set.setNumber} className="grid grid-cols-[3rem_1fr_1fr] gap-2"><span className="grid place-items-center rounded-lg bg-zinc-900">{set.setNumber}</span><input type="number" min="0" step=".5" placeholder="kg" value={set.weight ?? ""} onChange={(event) => setResult(exerciseIndex, setIndex, "weight", event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 p-3" /><input type="number" min="0" placeholder="reps" value={set.repetitions ?? ""} onChange={(event) => setResult(exerciseIndex, setIndex, "repetitions", event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 p-3" /></div>)}<button onClick={() => { const next = [...exercises]; next[exerciseIndex] = { ...exercise, sets: [...exercise.sets, { setNumber: exercise.sets.length + 1, weight: null, repetitions: null, unit: "kg", notes: "" }] }; setExercises(next); }} className="text-sm text-yellow-400">+ Agregar serie</button></div></article>)}</div><button onClick={() => setExercises([...exercises, { exerciseName: "", order: exercises.length + 1, notes: "", sets: [{ setNumber: 1, weight: null, repetitions: null, unit: "kg", notes: "" }] }])} className="mt-4 w-full rounded-xl border border-dashed border-zinc-700 p-3 text-yellow-400">+ Agregar ejercicio</button><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observación general" className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => save("DRAFT")} className="rounded-xl border border-yellow-400/40 p-3 font-bold text-yellow-300">Guardar borrador</button><button disabled={saving} onClick={() => save("COMPLETED")} className="rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950">Finalizar</button></div></section></div>;
}
