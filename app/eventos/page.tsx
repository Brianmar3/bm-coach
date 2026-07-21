"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import type { CoachEvent, EventStatus, EventType } from "@/types/gestion";

type EventDraft = Omit<CoachEvent, "id" | "createdAt">;
type ViewMode = "list" | "calendar";

const eventTypes: { value: EventType; label: string }[] = [
  { value: "evaluacion", label: "Evaluación" },
  { value: "reunion", label: "Reunión" },
  { value: "competencia", label: "Competencia" },
  { value: "recordatorio", label: "Recordatorio" },
];

const statuses: { value: EventStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "completado", label: "Completado" },
];

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): EventDraft => ({
  title: "",
  description: "",
  date: today(),
  time: "09:00",
  color: "#facc15",
  type: "recordatorio",
  status: "pendiente",
});

function showDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function typeLabel(type: EventType) {
  return eventTypes.find((item) => item.value === type)?.label ?? type;
}

async function responseError(response: Response, fallback: string) {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function EventosPage() {
  const [items, setItems] = useState<CoachEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | EventStatus>("todos");
  const [form, setForm] = useState<EventDraft>(blank());
  const [editing, setEditing] = useState<CoachEvent | null>(null);
  const [viewing, setViewing] = useState<CoachEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/eventos", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los eventos."));
        return response.json() as Promise<CoachEvent[]>;
      })
      .then((events) => {
        if (active) setItems(events);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los eventos desde Neon.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return [...items]
      .filter((item) => filter === "todos" || item.status === filter)
      .filter((item) => !normalizedQuery || `${item.title} ${item.description} ${typeLabel(item.type)}`.toLocaleLowerCase("es").includes(normalizedQuery))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [filter, items, query]);

  function begin(item?: CoachEvent) {
    setEditing(item ?? null);
    setForm(item ? {
      title: item.title,
      description: item.description,
      date: item.date,
      time: item.time,
      color: item.color,
      type: item.type,
      status: item.status,
    } : blank());
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/eventos/${editing.id}` : "/api/eventos", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el evento."));
      const saved = (await response.json()) as CoachEvent;
      setItems((current) => editing
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setOpen(false);
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el evento en Neon.");
    } finally {
      setSaving(false);
    }
  }

  async function complete(item: CoachEvent) {
    setError("");
    try {
      const response = await fetch(`/api/eventos/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          date: item.date,
          time: item.time,
          color: item.color,
          type: item.type,
          status: "completado",
        } satisfies EventDraft),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo completar el evento."));
      const saved = (await response.json()) as CoachEvent;
      setItems((current) => current.map((eventItem) => eventItem.id === saved.id ? saved : eventItem));
      if (viewing?.id === saved.id) setViewing(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el evento en Neon.");
    }
  }

  async function remove(item: CoachEvent) {
    if (!window.confirm(`¿Eliminar “${item.title}”? Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/eventos/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar el evento."));
      setItems((current) => current.filter((eventItem) => eventItem.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar el evento de Neon.");
    }
  }

  return (
    <ModuleShell
      title="Eventos"
      subtitle="Organizá evaluaciones, reuniones, competencias y recordatorios."
      action={<button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300">+ Crear evento</button>}
    >
      {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button onClick={() => setMode("list")} className={`rounded-lg px-3 py-2 text-sm ${mode === "list" ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>Lista</button>
          <button onClick={() => setMode("calendar")} className={`rounded-lg px-3 py-2 text-sm ${mode === "calendar" ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>Calendario</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, descripción o tipo" className={`${inputClass} sm:ml-auto sm:max-w-sm`} />
        <select value={filter} onChange={(event) => setFilter(event.target.value as "todos" | EventStatus)} className={`${inputClass} sm:w-48`}>
          <option value="todos">Todos los estados</option>
          {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </section>

      {mode === "list"
        ? <EventList items={visible} ready={ready} onView={setViewing} onEdit={begin} onComplete={complete} onRemove={remove} />
        : <Calendar events={visible} onView={setViewing} />}

      {open && <EventForm form={form} setForm={setForm} error={error} onClose={() => setOpen(false)} onSubmit={submit} editing={Boolean(editing)} saving={saving} />}
      {viewing && <EventDetail item={viewing} onClose={() => setViewing(null)} onComplete={complete} />}
    </ModuleShell>
  );
}

function EventList({ items, ready, onView, onEdit, onComplete, onRemove }: {
  items: CoachEvent[];
  ready: boolean;
  onView: (item: CoachEvent) => void;
  onEdit: (item: CoachEvent) => void;
  onComplete: (item: CoachEvent) => void;
  onRemove: (item: CoachEvent) => void;
}) {
  return <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-4">Evento</th><th>Fecha y hora</th><th>Tipo</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{ready && items.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-zinc-500">No hay eventos para mostrar.</td></tr> : items.map((item) => <tr key={item.id} className="border-t border-zinc-800"><td className="p-4"><div className="border-l-4 pl-3" style={{ borderLeftColor: item.color }}><span className="font-medium">{item.title}</span><span className="mt-1 block max-w-md truncate text-xs text-zinc-500">{item.description || "Sin descripción"}</span></div></td><td>{showDate(item.date)}<span className="block text-xs text-zinc-500">{item.time}</span></td><td>{typeLabel(item.type)}</td><td><StatusBadge status={item.status} /></td><td className="space-x-3 whitespace-nowrap pr-4 text-yellow-400"><button onClick={() => onView(item)}>Ver</button><button onClick={() => onEdit(item)}>Editar</button>{item.status === "pendiente" && <button onClick={() => onComplete(item)} className="text-emerald-300">Completar</button>}<button onClick={() => onRemove(item)} className="text-red-300">Eliminar</button></td></tr>)}</tbody></table></div></section>;
}

function Calendar({ events, onView }: { events: CoachEvent[]; onView: (event: CoachEvent) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index);
    return value.toISOString().slice(0, 10);
  });
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{days.map((day) => { const dayEvents = events.filter((item) => item.date === day); return <div key={day} className="min-h-40 rounded-2xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-sm font-bold capitalize text-zinc-300">{showDate(day)}</p><div className="mt-3 space-y-2">{dayEvents.length ? dayEvents.map((item) => <button key={item.id} onClick={() => onView(item)} className="w-full rounded-lg border-l-4 bg-zinc-800 p-2 text-left text-xs transition hover:bg-zinc-700" style={{ borderLeftColor: item.color }}><span className="block font-bold text-white">{item.time} · {item.title}</span><span className="text-zinc-400">{typeLabel(item.type)}</span></button>) : <p className="text-xs text-zinc-600">Sin eventos</p>}</div></div>; })}</section>;
}

function EventForm({ form, setForm, error, onClose, onSubmit, editing, saving }: {
  form: EventDraft;
  setForm: (form: EventDraft) => void;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  editing: boolean;
  saving: boolean;
}) {
  function change<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm({ ...form, [key]: value });
  }
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={onSubmit} className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar evento" : "Nuevo evento"}</h2><p className="mt-1 text-sm text-zinc-400">Completá los datos de la actividad.</p></div><button type="button" onClick={onClose} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Título<input required maxLength={120} value={form.title} onChange={(event) => change("title", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Fecha<input required type="date" value={form.date} onChange={(event) => change("date", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Hora<input required type="time" value={form.time} onChange={(event) => change("time", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Tipo<select value={form.type} onChange={(event) => change("type", event.target.value as EventType)} className={`${inputClass} mt-1`}>{eventTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Estado<select value={form.status} onChange={(event) => change("status", event.target.value as EventStatus)} className={`${inputClass} mt-1`}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><label className="sm:col-span-2">Color<div className="mt-1 flex items-center gap-3"><input aria-label="Color del evento" type="color" value={form.color} onChange={(event) => change("color", event.target.value)} className="h-11 w-16 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-1" /><input required pattern="#[0-9a-fA-F]{6}" value={form.color} onChange={(event) => change("color", event.target.value)} className={inputClass} /></div></label><label className="sm:col-span-2">Descripción<textarea maxLength={1000} value={form.description} onChange={(event) => change("description", event.target.value)} rows={4} className={`${inputClass} mt-1`} /></label></div><button disabled={saving} className="mt-6 w-full rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Guardando…" : "Guardar evento"}</button></form></div>;
}

function EventDetail({ item, onClose, onComplete }: { item: CoachEvent; onClose: () => void; onComplete: (item: CoachEvent) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><section className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div className="border-l-4 pl-3" style={{ borderLeftColor: item.color }}><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-1 text-sm text-zinc-400">{typeLabel(item.type)}</p></div><button onClick={onClose} className="self-start text-zinc-400">Cerrar</button></div><div className="mt-6 space-y-4 text-sm"><div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-950 p-4"><p><span className="block text-xs text-zinc-500">Fecha</span>{showDate(item.date)}</p><p><span className="block text-xs text-zinc-500">Hora</span>{item.time}</p></div><p><span className="mr-2 text-zinc-500">Estado:</span><StatusBadge status={item.status} /></p><p className="border-t border-zinc-800 pt-4 text-zinc-300">{item.description || "Sin descripción."}</p></div>{item.status === "pendiente" && <button onClick={() => onComplete(item)} className="mt-6 w-full rounded-xl border border-emerald-400/40 px-4 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-400/10">Marcar como completado</button>}</section></div>;
}

function StatusBadge({ status }: { status: EventStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status === "completado" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{status === "completado" ? "Completado" : "Pendiente"}</span>;
}
