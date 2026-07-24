"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { ClassOccurrenceAdmin } from "@/componentes/class-occurrence-admin";
import type { Student, WeeklyClassDay, WeeklyClassInput, WeeklyClassSchedule } from "@/types/gestion";

const days: Array<{ value: WeeklyClassDay; label: string; short: string }> = [
  { value: "MONDAY", label: "Lunes", short: "Lun" },
  { value: "TUESDAY", label: "Martes", short: "Mar" },
  { value: "WEDNESDAY", label: "Miércoles", short: "Mié" },
  { value: "THURSDAY", label: "Jueves", short: "Jue" },
  { value: "FRIDAY", label: "Viernes", short: "Vie" },
];

const classTypes = ["Entrenamiento funcional", "Fuerza", "Movilidad", "Personalizada", "Rehabilitación", "Running", "Stretching"];
type StatusFilter = "todos" | "activos" | "inactivos";

function emptySchedule(): WeeklyClassInput {
  return { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "10:00", classType: "", capacity: null, active: true, studentIds: [] };
}

function scheduleInput(schedule: WeeklyClassSchedule): WeeklyClassInput {
  return {
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    classType: schedule.classType,
    capacity: schedule.capacity,
    active: schedule.active,
    studentIds: schedule.studentIds,
  };
}

function dayName(day: WeeklyClassDay) {
  return days.find((item) => item.value === day)?.label ?? day;
}

function occupancy(schedule: WeeklyClassSchedule) {
  return schedule.capacity === null ? `${schedule.students.length} asignados` : `${schedule.students.length}/${schedule.capacity} lugares`;
}

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function ClasesPage() {
  const [schedules, setSchedules] = useState<WeeklyClassSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("activos");
  const [ready, setReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyClassSchedule | null>(null);
  const [viewing, setViewing] = useState<WeeklyClassSchedule | null>(null);
  const [form, setForm] = useState<WeeklyClassInput>(emptySchedule());
  const [studentQuery, setStudentQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/clases", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los horarios."));
        return response.json() as Promise<WeeklyClassSchedule[]>;
      }),
      fetch("/api/alumnos", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos."));
        return response.json() as Promise<Student[]>;
      }),
    ])
      .then(([weeklySchedules, realStudents]) => { setSchedules(weeklySchedules); setStudents(realStudents); })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => schedules.filter((schedule) => filter === "todos" || (filter === "activos" ? schedule.active : !schedule.active)), [filter, schedules]);
  const activeCount = schedules.filter((schedule) => schedule.active).length;
  const assignedCount = new Set(schedules.filter((schedule) => schedule.active).flatMap((schedule) => schedule.studentIds)).size;

  function begin(schedule?: WeeklyClassSchedule, preferredDay?: WeeklyClassDay) {
    setEditing(schedule ?? null);
    setForm(schedule ? scheduleInput(schedule) : { ...emptySchedule(), dayOfWeek: preferredDay ?? "MONDAY" });
    setStudentQuery("");
    setError("");
    setViewing(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setEditing(null);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.classType.trim() || form.endTime <= form.startTime) { setError("Completá el tipo de clase y revisá el horario."); return; }
    if (form.capacity !== null && form.studentIds.length > form.capacity) { setError("La cantidad de alumnos supera el cupo configurado."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/clases/${editing.id}` : "/api/clases", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, classType: form.classType.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el horario."));
      const saved = await response.json() as WeeklyClassSchedule;
      setSchedules((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setEditorOpen(false); setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el horario en Neon.");
    } finally {
      setSaving(false);
    }
  }

  async function changeActive(schedule: WeeklyClassSchedule) {
    setError("");
    try {
      const response = await fetch(`/api/clases/${schedule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scheduleInput(schedule), active: !schedule.active }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo cambiar el estado."));
      const saved = await response.json() as WeeklyClassSchedule;
      setSchedules((current) => current.map((item) => item.id === saved.id ? saved : item));
      setViewing(saved);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.");
    }
  }

  async function remove(schedule: WeeklyClassSchedule) {
    if (!window.confirm(`¿Eliminar definitivamente el horario de ${schedule.classType} del ${dayName(schedule.dayOfWeek).toLowerCase()}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/clases/${schedule.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar el horario."));
      const result = await response.json() as { action: "archived" | "deleted"; message: string };
      setSchedules((current) => result.action === "deleted" ? current.filter((item) => item.id !== schedule.id) : current.map((item) => item.id === schedule.id ? { ...item, active: false } : item));
      setViewing(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el horario.");
    }
  }

  return (
    <ModuleShell
      title="Clases"
      subtitle="Organizá tus horarios fijos de lunes a viernes y asigná alumnos a cada grupo."
      action={<button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300">+ Crear horario</button>}
    >
      {error && !editorOpen && <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Horarios activos" value={activeCount} />
        <Metric label="Alumnos con horario" value={assignedCount} />
        <Metric label="Bloques semanales" value={schedules.length} />
      </section>

      <ClassOccurrenceAdmin />

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Calendario semanal</h2>
            <p className="mt-1 text-xs text-zinc-500">Tocá cualquier bloque para ver alumnos y acciones.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)} className={`${inputClass} sm:w-48`}>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
            <option value="todos">Todos los horarios</option>
          </select>
        </div>

        {!ready ? <LoadingCalendar /> : (
          <>
            <div className="hidden grid-cols-5 divide-x divide-zinc-800 lg:grid">
              {days.map((day) => <DayColumn key={day.value} day={day} schedules={visible.filter((item) => item.dayOfWeek === day.value)} open={setViewing} create={() => begin(undefined, day.value)} />)}
            </div>
            <div className="divide-y divide-zinc-800 lg:hidden">
              {days.map((day) => <MobileDay key={day.value} day={day} schedules={visible.filter((item) => item.dayOfWeek === day.value)} open={setViewing} create={() => begin(undefined, day.value)} />)}
            </div>
          </>
        )}
      </section>

      {viewing && <ScheduleDetail schedule={viewing} close={() => setViewing(null)} edit={() => begin(viewing)} changeActive={() => changeActive(viewing)} remove={() => remove(viewing)} />}
      {editorOpen && <ScheduleEditor form={form} setForm={setForm} students={students} studentQuery={studentQuery} setStudentQuery={setStudentQuery} error={error} saving={saving} editing={Boolean(editing)} close={closeEditor} save={save} />}
    </ModuleShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold text-yellow-400">{value}</p></div>;
}

function ScheduleBlock({ schedule, open }: { schedule: WeeklyClassSchedule; open: (schedule: WeeklyClassSchedule) => void }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  return (
    <article className={`w-full rounded-xl border p-3 text-left transition hover:border-yellow-400/70 ${schedule.active ? "border-yellow-400/25 bg-yellow-400/5" : "border-zinc-700 bg-zinc-950/70 opacity-65"}`}>
      <button onClick={() => open(schedule)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold text-yellow-400">{schedule.startTime} – {schedule.endTime}</span>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${schedule.active ? "bg-emerald-400" : "bg-zinc-600"}`} title={schedule.active ? "Activo" : "Inactivo"} />
        </div>
        <p className="mt-2 font-semibold leading-tight text-white">{schedule.classType}</p>
        <p className="mt-2 text-xs text-zinc-400">{occupancy(schedule)}</p>
        {schedule.students.length > 0 && <p className="mt-1 truncate text-xs text-zinc-500">{schedule.students.slice(0, 2).map((student) => student.name).join(", ")}{schedule.students.length > 2 ? ` +${schedule.students.length - 2}` : ""}</p>}
      </button>
      <Link href={`/asistencias?scheduleId=${encodeURIComponent(schedule.id)}&date=${today}`} className="mt-3 block rounded-lg border border-emerald-400/30 px-3 py-2 text-center text-xs font-bold text-emerald-300 hover:bg-emerald-400/10">Tomar asistencia</Link>
    </article>
  );
}

function DayColumn({ day, schedules, open, create }: { day: (typeof days)[number]; schedules: WeeklyClassSchedule[]; open: (schedule: WeeklyClassSchedule) => void; create: () => void }) {
  const ordered = [...schedules].sort((left, right) => left.startTime.localeCompare(right.startTime));
  return <section className="min-h-[430px] p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{day.label}</h3><button onClick={create} className="rounded-lg px-2 py-1 text-lg text-zinc-500 hover:bg-yellow-400/10 hover:text-yellow-400" aria-label={`Crear horario el ${day.label}`}>+</button></div><div className="space-y-3">{ordered.length ? ordered.map((schedule) => <ScheduleBlock key={schedule.id} schedule={schedule} open={open} />) : <button onClick={create} className="w-full rounded-xl border border-dashed border-zinc-800 px-2 py-8 text-xs text-zinc-600 hover:border-zinc-700 hover:text-zinc-400">Sin horarios<br />Agregar bloque</button>}</div></section>;
}

function MobileDay({ day, schedules, open, create }: { day: (typeof days)[number]; schedules: WeeklyClassSchedule[]; open: (schedule: WeeklyClassSchedule) => void; create: () => void }) {
  const ordered = [...schedules].sort((left, right) => left.startTime.localeCompare(right.startTime));
  return <section className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-yellow-400">{day.label}</h3><button onClick={create} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">+ Agregar</button></div>{ordered.length ? <div className="grid gap-3 sm:grid-cols-2">{ordered.map((schedule) => <ScheduleBlock key={schedule.id} schedule={schedule} open={open} />)}</div> : <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-sm text-zinc-600">Sin horarios</p>}</section>;
}

function LoadingCalendar() {
  return <div className="grid animate-pulse gap-4 p-4 lg:grid-cols-5">{days.map((day) => <div key={day.value}><div className="mb-3 h-5 w-20 rounded bg-zinc-800" /><div className="h-28 rounded-xl bg-zinc-800/60" /></div>)}</div>;
}

function ScheduleDetail({ schedule, close, edit, changeActive, remove }: { schedule: WeeklyClassSchedule; close: () => void; edit: () => void; changeActive: () => void; remove: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true">
      <section className="mx-auto my-8 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">{dayName(schedule.dayOfWeek)}</p><h2 className="mt-2 text-2xl font-bold">{schedule.classType}</h2><p className="mt-1 text-zinc-400">{schedule.startTime} – {schedule.endTime}</p></div><button onClick={close} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">Cerrar</button></div>
        <dl className="mt-6 grid grid-cols-2 gap-3"><DetailValue label="Estado" value={schedule.active ? "Activo" : "Inactivo"} highlight={schedule.active} /><DetailValue label="Cupo" value={schedule.capacity === null ? "Sin límite" : `${schedule.students.length} de ${schedule.capacity}`} /></dl>
        <div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-semibold">Alumnos asignados</h3><span className="text-sm text-zinc-500">{schedule.students.length}</span></div>{schedule.students.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{schedule.students.map((student) => <div key={student.id} className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-3 text-sm"><span>{student.name}</span><span className={student.status === "activo" ? "text-emerald-400" : "text-zinc-600"}>{student.status}</span></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">Todavía no hay alumnos asignados.</p>}</div>
        <div className="mt-7 grid gap-2 sm:grid-cols-2"><button onClick={edit} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">Editar y asignar alumnos</button><button onClick={changeActive} className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-white">{schedule.active ? "Desactivar horario" : "Activar horario"}</button><button onClick={remove} className="rounded-xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-300 sm:col-span-2">Eliminar definitivamente</button></div>
      </section>
    </div>
  );
}

function DetailValue({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-xl bg-zinc-950 p-4"><dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt><dd className={`mt-1 font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</dd></div>;
}

function ScheduleEditor({ form, setForm, students, studentQuery, setStudentQuery, error, saving, editing, close, save }: { form: WeeklyClassInput; setForm: (form: WeeklyClassInput) => void; students: Student[]; studentQuery: string; setStudentQuery: (value: string) => void; error: string; saving: boolean; editing: boolean; close: () => void; save: (event: FormEvent) => void }) {
  function set<K extends keyof WeeklyClassInput>(key: K, value: WeeklyClassInput[K]) { setForm({ ...form, [key]: value }); }
  function toggle(studentId: string) { set("studentIds", form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId]); }
  const normalizedQuery = studentQuery.trim().toLocaleLowerCase("es");
  const visibleStudents = students.filter((student) => !normalizedQuery || `${student.firstName} ${student.lastName} ${student.phone}`.toLocaleLowerCase("es").includes(normalizedQuery));
  const atCapacity = form.capacity !== null && form.studentIds.length >= form.capacity;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={save} className="mx-auto my-3 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:my-8 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Plantilla recurrente</p><h2 className="mt-1 text-xl font-bold">{editing ? "Editar horario semanal" : "Crear horario semanal"}</h2></div><button type="button" onClick={close} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800">Cerrar</button></div>
        {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Tipo de clase<input required maxLength={120} list="class-types" value={form.classType} onChange={(event) => set("classType", event.target.value)} placeholder="Ej. Entrenamiento funcional" className={`${inputClass} mt-1`} /><datalist id="class-types">{classTypes.map((type) => <option key={type} value={type} />)}</datalist></label>
          <label className="text-sm">Día de la semana<select value={form.dayOfWeek} onChange={(event) => set("dayOfWeek", event.target.value as WeeklyClassDay)} className={`${inputClass} mt-1`}>{days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
          <label className="text-sm">Estado<select value={form.active ? "activo" : "inactivo"} onChange={(event) => set("active", event.target.value === "activo")} className={`${inputClass} mt-1`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label className="text-sm">Hora de inicio<input required type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm">Hora de finalización<input required type="time" value={form.endTime} onChange={(event) => set("endTime", event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm sm:col-span-2">Cupo opcional<input type="number" min={1} max={500} value={form.capacity ?? ""} onChange={(event) => set("capacity", event.target.value === "" ? null : Number(event.target.value))} placeholder="Sin límite" className={`${inputClass} mt-1`} /><span className="mt-1 block text-xs text-zinc-500">Dejalo vacío si el grupo no tiene límite.</span></label>
        </div>

        <section className="mt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h3 className="font-semibold">Alumnos asignados <span className="text-sm font-normal text-zinc-500">({form.studentIds.length}{form.capacity === null ? "" : `/${form.capacity}`})</span></h3><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Buscar alumno o teléfono" className={`${inputClass} sm:w-72`} /></div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2">
            {visibleStudents.length ? visibleStudents.map((student) => { const selected = form.studentIds.includes(student.id); const disabled = !selected && atCapacity; return <label key={student.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm transition ${selected ? "border-yellow-400/50 bg-yellow-400/10" : "border-zinc-800 bg-zinc-900"} ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-zinc-600"}`}><span><span className="block font-medium">{student.firstName} {student.lastName}</span><span className="mt-0.5 block text-xs text-zinc-500">{student.phone} · {student.status}</span></span><input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggle(student.id)} className="h-4 w-4 accent-yellow-400" /></label>; }) : <p className="p-5 text-center text-sm text-zinc-500">No hay alumnos que coincidan.</p>}
          </div>
        </section>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} disabled={saving} className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-zinc-300">Cancelar</button><button disabled={saving} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar horario"}</button></div>
      </form>
    </div>
  );
}
