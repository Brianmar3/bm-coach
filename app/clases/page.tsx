"use client";
import { StudentAssignmentOptions } from "@/componentes/student-assignment-options";
import { KeyboardDialog, preventImplicitSubmit } from "@/componentes/keyboard-dialog";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";
import { ClassOccurrenceAdmin } from "@/componentes/class-occurrence-admin";
import { ClassOpinionsPanel } from "@/componentes/class-opinions-panel";
import { EmptyState, ErrorState } from "@/componentes/async-states";
import type { Student, WeeklyClassDay, WeeklyClassInput, WeeklyClassSchedule } from "@/types/gestion";
import { useTouchClassCopy } from "@/componentes/use-touch-class-copy";
import { BmCalendarIcon } from "@/componentes/icons";

const days: Array<{ value: WeeklyClassDay; label: string; short: string }> = [
  { value: "MONDAY", label: "Lunes", short: "Lun" },
  { value: "TUESDAY", label: "Martes", short: "Mar" },
  { value: "WEDNESDAY", label: "Miércoles", short: "Mié" },
  { value: "THURSDAY", label: "Jueves", short: "Jue" },
  { value: "FRIDAY", label: "Viernes", short: "Vie" },
  { value: "SATURDAY", label: "Sábado", short: "Sáb" },
  { value: "SUNDAY", label: "Domingo", short: "Dom" },
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

function nextScheduleDate(day: WeeklyClassDay) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  const targetWeekday = (days.findIndex((item) => item.value === day) + 1) % 7;
  const daysUntilTarget = (targetWeekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilTarget);
  return date.toISOString().slice(0, 10);
}

function shiftDate(value: string, daysToAdd: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function currentWeekStart() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return shiftDate(today, -((weekday + 6) % 7));
}

function shortDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
}

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function ClasesPage() {
  const [schedules, setSchedules] = useState<WeeklyClassSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("activos");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [suspendedDates, setSuspendedDates] = useState<string[]>([]);
  const [suspensionError, setSuspensionError] = useState("");
  const [suspensionBusy, setSuspensionBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyClassSchedule | null>(null);
  const [viewing, setViewing] = useState<WeeklyClassSchedule | null>(null);
  const [form, setForm] = useState<WeeklyClassInput>(emptySchedule());
  const [selectedDays, setSelectedDays] = useState<WeeklyClassDay[]>(["MONDAY"]);
  const [studentQuery, setStudentQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const copying = useRef(false);
  const savingRef = useRef(false);
  const lastDrop = useRef({ key: "", at: 0 });
  const scheduleCopy = useTouchClassCopy((id, day, at) => void copySchedule(id, day as WeeklyClassDay, at), "data-schedule-day");

  async function copySchedule(id: string, day: WeeklyClassDay, at: number) {
    const source = schedules.find((item) => item.id === id);
    if (!source || !days.some((item) => item.value === day) || source.dayOfWeek === day || copying.current) return;
    const key = `${id}:${day}`;
    if (lastDrop.current.key === key && at - lastDrop.current.at < 1000) return;
    lastDrop.current = { key, at };
    const duplicate = schedules.some((item) => item.dayOfWeek === day && item.startTime === source.startTime && item.endTime === source.endTime && item.classType.trim().toLocaleLowerCase("es") === source.classType.trim().toLocaleLowerCase("es"));
    if (duplicate) { setError("Ese horario ya existe en el día elegido."); return; }
    copying.current = true;
    setError("");
    try {
      const response = await fetch("/api/clases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scheduleInput(source), dayOfWeek: day, studentIds: [] }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo copiar el horario."));
      const saved = await response.json() as WeeklyClassSchedule;
      setSchedules((current) => [...current, saved]);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "No se pudo copiar el horario.");
    } finally {
      copying.current = false;
    }
  }

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
      .then(([weeklySchedules, realStudents]) => {
        setSchedules(weeklySchedules); setStudents(realStudents);
        setLoadError("");
        if (new URLSearchParams(window.location.search).get("accion") === "nueva") {
          setEditing(null); setForm(emptySchedule()); setSelectedDays(["MONDAY"]); setStudentQuery(""); setEditorOpen(true);
        }
      })
      .catch((value: unknown) => { if (value instanceof Error && value.name !== "AbortError") setLoadError("No pudimos cargar los horarios semanales."); })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clases/suspensiones?from=${weekStart}&to=${shiftDate(weekStart, 6)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("No se pudieron cargar las suspensiones."); return response.json() as Promise<string[]>; })
      .then((dates) => { setSuspendedDates(dates); setSuspensionError(""); })
      .catch((reason: unknown) => { if (reason instanceof Error && reason.name !== "AbortError") setSuspensionError("No se pudo verificar la suspensión de esta semana."); });
    return () => controller.abort();
  }, [weekStart, reload]);

  async function changeSuspension(date: string, suspended: boolean) {
    if (suspensionBusy) return;
setSuspensionError("");
    if (suspended && !window.confirm(`¿Suspender todas las clases del ${shortDate(date)}?\n\nSolo afecta esta fecha; los horarios y las asistencias se conservan.`)) return;
    setSuspensionBusy(true);
    try {
      const response = await fetch("/api/clases/suspensiones", { method: suspended ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo actualizar el día."));
      setSuspendedDates((current) => suspended ? [...new Set([...current, date])] : current.filter((item) => item !== date));
      setSuspensionError("");
    } catch (reason) {
      setSuspensionError(reason instanceof Error ? reason.message : "No se pudo actualizar el día.");
    } finally { setSuspensionBusy(false); }
  }

  const visible = useMemo(() => schedules.filter((schedule) => filter === "todos" || (filter === "activos" ? schedule.active : !schedule.active)), [filter, schedules]);
  const activeCount = schedules.filter((schedule) => schedule.active).length;
  const assignedCount = new Set(schedules.filter((schedule) => schedule.active).flatMap((schedule) => schedule.studentIds)).size;
  function retryLoad() {
    setLoadError("");
    if (!schedules.length) setReady(false);
    setReload((value) => value + 1);
  }

  function begin(schedule?: WeeklyClassSchedule, preferredDay?: WeeklyClassDay) {
    setEditing(schedule ?? null);
    setForm(schedule ? scheduleInput(schedule) : { ...emptySchedule(), dayOfWeek: preferredDay ?? "MONDAY" });
    setSelectedDays([schedule?.dayOfWeek ?? preferredDay ?? "MONDAY"]);
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
    if (savingRef.current) return;
    if (!editing && selectedDays.length === 0) { setError("Seleccioná al menos un día."); return; }
    if (!form.classType.trim() || form.endTime <= form.startTime) { setError("Completá el tipo de clase y revisá el horario."); return; }
    if (form.capacity !== null && form.studentIds.length > form.capacity) { setError("La cantidad de alumnos supera el cupo configurado."); return; }
    savingRef.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/clases/${editing.id}` : "/api/clases", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, classType: form.classType.trim(), ...(!editing ? { dayOfWeeks: selectedDays } : {}) }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el horario."));
      const saved = await response.json() as WeeklyClassSchedule | WeeklyClassSchedule[];
      setSchedules((current) => editing ? current.map((item) => item.id === (saved as WeeklyClassSchedule).id ? saved as WeeklyClassSchedule : item) : [...current, ...(Array.isArray(saved) ? saved : [saved])]);
      setEditorOpen(false); setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el horario en Neon.");
    } finally {
      savingRef.current = false; setSaving(false);
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
    if (!window.confirm(`¿Eliminar el horario de ${schedule.classType} del ${dayName(schedule.dayOfWeek).toLowerCase()}?\n\nSe quitará de la planificación futura. Las clases y asistencias anteriores se conservarán.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/clases/${schedule.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar el horario."));
      await response.json() as { action: "deleted"; message: string };
      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      setViewing(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el horario.");
    }
  }

  return (
    <ModuleShell
      unified
      title=""
      subtitle=""
      hideHeader
      flushTop
    >
      {error && !editorOpen && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {suspensionError && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-[var(--foreground)]">{suspensionError} <button type="button" onClick={() => { setSuspensionError(""); setReload((value) => value + 1); }} className="underline">Reintentar</button></p>}
      {loadError && schedules.length > 0 && <div className="mb-5"><ErrorState compact title="No pudimos actualizar los horarios." retry={retryLoad}/></div>}

      <section className="mb-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-3">
        {!ready ? <div aria-hidden="true" className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-zinc-800/70"/>)}</div> : <div className="grid grid-cols-3 divide-x divide-zinc-800"><Metric label="Horarios activos" value={activeCount} /><Metric label="Alumnos con horario" value={assignedCount} /><Metric label="Bloques semanales" value={schedules.length} /></div>}
      </section>

      <ClassOccurrenceAdmin />
      <ClassOpinionsPanel />

      <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--foreground)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Calendario semanal</h2>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Tocá cualquier bloque para ver alumnos y acciones.</p>
            <div className="mt-2 flex items-center gap-2 text-xs"><button type="button" onClick={() => setWeekStart((value) => shiftDate(value, -7))} aria-label="Semana anterior" className="rounded-lg border border-[var(--border-soft)] px-2 py-1.5">←</button><span>{shortDate(weekStart)} – {shortDate(shiftDate(weekStart, 6))}</span><button type="button" onClick={() => setWeekStart((value) => shiftDate(value, 7))} aria-label="Semana siguiente" className="rounded-lg border border-[var(--border-soft)] px-2 py-1.5">→</button></div>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)} className={`${inputClass} sm:w-48`}>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
            <option value="todos">Todos los horarios</option>
          </select>
        </div>

        {!ready ? <LoadingCalendar /> : loadError && schedules.length === 0 ? <div className="p-4"><ErrorState title="No pudimos cargar los horarios." description="La agenda no cambió. Intentá nuevamente." retry={retryLoad}/></div> : schedules.length === 0 ? <div className="p-4"><EmptyState title="Todavía no hay horarios semanales." description="Creá el primer horario para organizar clases y asistencias." action={<button type="button" onClick={() => begin()} className="min-h-11 px-4 text-sm font-bold text-yellow-300">Crear horario</button>}/></div> : (
          <>
            <div className="hidden gap-px bg-[var(--border-soft)] lg:grid lg:grid-cols-4 2xl:grid-cols-7">
              {days.map((day, index) => <DayColumn key={day.value} day={day} date={shiftDate(weekStart, index)} suspended={suspendedDates.includes(shiftDate(weekStart, index))} suspensionBusy={suspensionBusy} changeSuspension={changeSuspension} schedules={visible.filter((item) => item.dayOfWeek === day.value)} open={setViewing} create={() => begin(undefined, day.value)} drag={scheduleCopy} copy={copySchedule} />)}
            </div>
            <div className="divide-y divide-zinc-800 lg:hidden">
              {days.map((day, index) => <MobileDay key={day.value} day={day} date={shiftDate(weekStart, index)} suspended={suspendedDates.includes(shiftDate(weekStart, index))} suspensionBusy={suspensionBusy} changeSuspension={changeSuspension} schedules={visible.filter((item) => item.dayOfWeek === day.value)} open={setViewing} create={() => begin(undefined, day.value)} drag={scheduleCopy} copy={copySchedule} />)}
            </div>
          </>
        )}
      </section>

      {viewing && <ScheduleDetail schedule={viewing} close={() => setViewing(null)} edit={() => begin(viewing)} changeActive={() => changeActive(viewing)} remove={() => remove(viewing)} />}
      {editorOpen && <ScheduleEditor form={form} setForm={setForm} selectedDays={selectedDays} setSelectedDays={setSelectedDays} students={students} studentQuery={studentQuery} setStudentQuery={setStudentQuery} error={error} saving={saving} editing={Boolean(editing)} close={closeEditor} save={save} />}
      <TrainerFloatingActions mode="direct" enabled={!editorOpen && !viewing} actions={[{ label: "Crear horario", symbol: "+", onSelect: () => begin() }]} />
    </ModuleShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center px-1 py-1 text-center sm:min-h-0 sm:px-2"><p className="flex min-h-8 items-center justify-center text-[8px] uppercase leading-[1.2] tracking-[.08em] text-[var(--foreground-muted)] min-[390px]:text-[9px] sm:min-h-0 sm:text-[10px] sm:tracking-wide">{label}</p><p className="mt-1 text-xl font-bold leading-none text-[var(--brand-text)]">{value}</p></div>;
}

type ScheduleDrag = ReturnType<typeof useTouchClassCopy>;
type ScheduleDayProps = { day: (typeof days)[number]; date: string; suspended: boolean; suspensionBusy: boolean; changeSuspension: (date: string, suspended: boolean) => Promise<void>; schedules: WeeklyClassSchedule[]; open: (schedule: WeeklyClassSchedule) => void; create: () => void; drag: ScheduleDrag; copy: (id: string, day: WeeklyClassDay, at: number) => void };

function DaySuspensionMenu({
  date,
  suspended,
  busy,
  change,
}: {
  date: string;
  suspended: boolean;
  busy: boolean;
  change: (date: string, suspended: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  const isPast = date < today;

  async function handleChange() {
    if (busy || isPast) return;
    setOpen(false);
    await change(date, !suspended);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Acciones del ${shortDate(date)}`}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]"
      >
        ⋯
      </button>

      {open && (
        <KeyboardDialog
          onClose={() => setOpen(false)}
          aria-label={`Acciones del ${shortDate(date)}`}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 text-[var(--foreground)] shadow-2xl">
            <h2 className="text-lg font-bold">
              Acciones del día
            </h2>

            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              {shortDate(date)}
            </p>

            {isPast ? (
              <p className="mt-4 text-sm text-[var(--foreground-muted)]">
                No se pueden modificar suspensiones de fechas anteriores.
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleChange()}
                className="mt-5 w-full rounded-xl border border-[var(--border-soft)] px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-50"
              >
                {suspended
                  ? "Reactivar clases del día"
                  : "Suspender clases del día"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-xl border border-[var(--border-soft)] px-4 py-3 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </KeyboardDialog>
      )}
    </>
  );
}
function ScheduleBlock({ schedule, date, suspended, open, drag }: { schedule: WeeklyClassSchedule; date: string; suspended: boolean; open: (schedule: WeeklyClassSchedule) => void; drag: ScheduleDrag }) {
  return (
    <article draggable tabIndex={0} aria-label={`${schedule.classType}, ${schedule.startTime} a ${schedule.endTime}`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); open(schedule); } }} onDragStart={(event) => { if (drag.isTouchPending() || (event.target as HTMLElement).closest("a")) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", schedule.id); drag.startMouse(event); }} onDragEnd={drag.stopMouse} onTouchStart={(event) => { if (!(event.target as HTMLElement).closest("a")) drag.start(event, schedule.id); }} onTouchMove={drag.moveBeforeActivation} onTouchEnd={drag.endBeforeActivation} onTouchCancel={drag.endBeforeActivation} onContextMenu={(event) => { if (drag.isTouchPending()) event.preventDefault(); }} className={`w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2.5 text-left shadow-sm transition hover:border-[var(--bm-accent)] focus-visible:outline-2 focus-visible:outline-[var(--bm-accent)] ${schedule.active ? "" : "opacity-65"}`}>
      <button onClick={(event) => { if (drag.consumeClick()) { event.preventDefault(); return; } open(schedule); }} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold text-[var(--brand-text)]">{schedule.startTime} – {schedule.endTime}</span>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${schedule.active ? "bg-emerald-400" : "bg-zinc-600"}`} title={schedule.active ? "Activo" : "Inactivo"} />
        </div>
        <p className="mt-1 break-words text-sm font-semibold leading-tight text-[var(--foreground)]">{schedule.classType}</p>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">{occupancy(schedule)}</p>
        {schedule.students.length > 0 && <p className="mt-1 truncate text-xs text-[var(--foreground-muted)]" title={schedule.students.map((student) => student.name).join(", ")}>{schedule.students.slice(0, 2).map((student) => student.name).join(", ")}{schedule.students.length > 2 ? ` +${schedule.students.length - 2}` : ""}</p>}
      </button>
      {suspended ? <span className="mt-2 block rounded-lg border border-[var(--border-soft)] px-2 py-2 text-center text-xs text-[var(--foreground-muted)]">Sin asistencia disponible</span> : <Link href={`/asistencias?view=attendance&scheduleId=${encodeURIComponent(schedule.id)}&date=${date}`} className="mt-2 block min-h-9 rounded-lg border border-emerald-400/35 px-2 py-2 text-center text-xs font-bold text-emerald-400 hover:bg-emerald-400/10">Tomar asistencia</Link>}
    </article>
  );
}

function DayColumn({ day, date, suspended, suspensionBusy, changeSuspension, schedules, open, create, drag, copy }: ScheduleDayProps) {
  const ordered = [...schedules].sort((left, right) => left.startTime.localeCompare(right.startTime));
  return <section data-schedule-day={day.value} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); drag.stopMouse(); if (id) void copy(id, day.value, event.timeStamp); }} className="min-h-[220px] min-w-0 bg-[var(--surface-elevated)] p-2.5"><div className="mb-2 flex items-center justify-between gap-1"><h3 className="min-w-0 truncate text-sm font-bold text-[var(--foreground)]">{day.label} <span className="text-xs font-normal text-[var(--foreground-muted)]">{shortDate(date)}</span></h3><div className="flex shrink-0 items-center"><DaySuspensionMenu date={date} suspended={suspended} busy={suspensionBusy} change={changeSuspension}/><button onClick={create} className="rounded-lg px-2 py-1 text-lg text-[var(--brand-text)] hover:bg-[var(--surface)]" aria-label={`Crear horario el ${day.label}`}>+</button></div></div>{suspended && <p className="mb-2 rounded-lg border border-[var(--border-soft)] px-2 py-1 text-xs text-[var(--brand-text)]">Clases suspendidas</p>}<div className="space-y-2">{ordered.length ? ordered.map((schedule) => <ScheduleBlock key={schedule.id} schedule={schedule} date={date} suspended={suspended} open={open} drag={drag} />) : <button onClick={create} className="w-full rounded-xl border border-dashed border-[var(--border-soft)] px-2 py-6 text-xs text-[var(--foreground-muted)]">Sin horarios<br />Agregar bloque</button>}</div></section>;
}

function MobileDay({ day, date, suspended, suspensionBusy, changeSuspension, schedules, open, create, drag, copy }: ScheduleDayProps) {
  const ordered = [...schedules].sort((left, right) => left.startTime.localeCompare(right.startTime));
  return <section data-schedule-day={day.value} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); drag.stopMouse(); if (id) void copy(id, day.value, event.timeStamp); }} className="p-3"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-bold text-[var(--brand-text)]">{day.label} <span className="text-xs font-normal text-[var(--foreground-muted)]">{shortDate(date)}</span></h3><div className="flex items-center gap-1"><DaySuspensionMenu date={date} suspended={suspended} busy={suspensionBusy} change={changeSuspension}/><button onClick={create} className="min-h-9 rounded-lg border border-[var(--border-soft)] px-2 text-xs text-[var(--foreground)]">+ Agregar</button></div></div>{suspended && <p className="mb-2 rounded-lg border border-[var(--border-soft)] px-2 py-1 text-xs text-[var(--brand-text)]">Clases suspendidas</p>}{ordered.length ? <div className="grid gap-2 sm:grid-cols-2">{ordered.map((schedule) => <ScheduleBlock key={schedule.id} schedule={schedule} date={date} suspended={suspended} open={open} drag={drag} />)}</div> : <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-center text-sm text-[var(--foreground-muted)]">Sin horarios</p>}</section>;
}

function LoadingCalendar() {
  return <div className="grid animate-pulse gap-4 p-4 lg:grid-cols-5">{days.map((day) => <div key={day.value}><div className="mb-3 h-5 w-20 rounded bg-zinc-800" /><div className="h-28 rounded-xl bg-zinc-800/60" /></div>)}</div>;
}

function ScheduleDetail({ schedule, close, edit, changeActive, remove }: { schedule: WeeklyClassSchedule; close: () => void; edit: () => void; changeActive: () => void; remove: () => void }) {
  return (
    <KeyboardDialog as="div" onClose={close} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true">
      <section className="mx-auto my-8 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">{dayName(schedule.dayOfWeek)}</p><h2 className="mt-2 text-2xl font-bold">{schedule.classType}</h2><p className="mt-1 text-zinc-400">{schedule.startTime} – {schedule.endTime}</p></div><button onClick={close} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">Cerrar</button></div>
        <dl className="mt-6 grid grid-cols-2 gap-3"><DetailValue label="Estado" value={schedule.active ? "Activo" : "Inactivo"} highlight={schedule.active} /><DetailValue label="Cupo" value={schedule.capacity === null ? "Sin límite" : `${schedule.students.length} de ${schedule.capacity}`} /></dl>
        <div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-semibold">Alumnos asignados</h3><span className="text-sm text-zinc-500">{schedule.students.length}</span></div>{schedule.students.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{schedule.students.map((student) => <div key={student.id} className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-3 text-sm"><span>{student.name}</span><span className={student.status === "activo" ? "text-emerald-400" : "text-zinc-600"}>{student.status}</span></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">Todavía no hay alumnos asignados.</p>}</div>
        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          <Link
            href={`/asistencias?view=attendance&scheduleId=${encodeURIComponent(schedule.id)}&date=${nextScheduleDate(schedule.dayOfWeek)}`}
            className="rounded-xl bg-emerald-400 px-4 py-3 text-center font-bold text-zinc-950 sm:col-span-2"
          >
            Tomar asistencia
          </Link>
          <button onClick={edit} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">Editar y asignar alumnos</button><button onClick={changeActive} className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-white">{schedule.active ? "Desactivar horario" : "Activar horario"}</button><button onClick={remove} className="rounded-xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-300 sm:col-span-2">Eliminar horario</button>
        </div>
      </section>
    </KeyboardDialog>
  );
}

function DetailValue({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-xl bg-zinc-950 p-4"><dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt><dd className={`mt-1 font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</dd></div>;
}

function ScheduleEditor({ form, setForm, selectedDays, setSelectedDays, students, studentQuery, setStudentQuery, error, saving, editing, close, save }: { form: WeeklyClassInput; setForm: (form: WeeklyClassInput) => void; selectedDays: WeeklyClassDay[]; setSelectedDays: (days: WeeklyClassDay[]) => void; students: Student[]; studentQuery: string; setStudentQuery: (value: string) => void; error: string; saving: boolean; editing: boolean; close: () => void; save: (event: FormEvent) => void }) {
  function set<K extends keyof WeeklyClassInput>(key: K, value: WeeklyClassInput[K]) { setForm({ ...form, [key]: value }); }
  function toggle(studentId: string) { set("studentIds", form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId]); }
  const normalizedQuery = studentQuery.trim().toLocaleLowerCase("es");
  const visibleStudents = students.filter((student) => !normalizedQuery || `${student.firstName} ${student.lastName} ${student.phone}`.toLocaleLowerCase("es").includes(normalizedQuery));
  const atCapacity = form.capacity !== null && form.studentIds.length >= form.capacity;

  return (
    <KeyboardDialog onClose={close} dismissible={!saving} aria-label={editing ? "Editar horario semanal" : "Crear horario semanal"} className="fixed inset-0 z-[120] overflow-y-auto bg-zinc-950 p-0 sm:bg-black/85 sm:p-4">
      <form onSubmit={save} onKeyDown={preventImplicitSubmit} className="mx-auto min-h-dvh w-full max-w-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] text-[var(--foreground)] shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand-text)]">Plantilla recurrente</p><h2 className="mt-1 text-xl font-bold">{editing ? "Editar horario semanal" : "Crear horario semanal"}</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">{editing ? "Modificá este horario sin alterar los demás." : "Creá uno o varios horarios con la misma configuración."}</p></div><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-xl border border-[var(--border-soft)] p-2 text-[var(--brand-text)] sm:block"><BmCalendarIcon size={22} /></span><button type="button" onClick={close} className="rounded-lg p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface)]">Cerrar</button></div></div>
        {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          <label className="col-span-2 text-sm">Tipo de clase<input required maxLength={120} list="class-types" value={form.classType} onChange={(event) => set("classType", event.target.value)} placeholder="Ej. Entrenamiento funcional" className={`${inputClass} mt-1`} /><datalist id="class-types">{classTypes.map((type) => <option key={type} value={type} />)}</datalist></label>
          {editing ? <label className="text-sm">Día de la semana<select value={form.dayOfWeek} onChange={(event) => set("dayOfWeek", event.target.value as WeeklyClassDay)} className={`${inputClass} mt-1`}>{days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label> : <fieldset className="col-span-2"><legend className="mb-2 text-sm font-medium">Seleccioná los días</legend><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{days.map((day) => { const active = selectedDays.includes(day.value); return <button key={day.value} type="button" aria-pressed={active} aria-label={day.label} onClick={() => setSelectedDays(active ? selectedDays.filter((value) => value !== day.value) : days.filter((value) => value.value === day.value || selectedDays.includes(value.value)).map((value) => value.value))} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold transition ${active ? "border-[var(--bm-accent)] bg-[color-mix(in_srgb,var(--bm-accent)_20%,var(--surface))] text-[var(--brand-text)]" : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--foreground)]"}`}>{day.short}{active ? " ✓" : ""}</button>; })}</div><p className="mt-2 text-xs text-[var(--foreground-muted)]">{selectedDays.length} {selectedDays.length === 1 ? "día seleccionado" : "días seleccionados"}</p></fieldset>}
          <label className="col-span-2 text-sm">Estado<select value={form.active ? "activo" : "inactivo"} onChange={(event) => set("active", event.target.value === "activo")} className={`${inputClass} mt-1`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label className="text-sm">Hora de inicio<input required type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm">Hora de finalización<input required type="time" value={form.endTime} onChange={(event) => set("endTime", event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="col-span-2 text-sm">Cupo opcional<input type="number" min={1} max={500} value={form.capacity ?? ""} onChange={(event) => set("capacity", event.target.value === "" ? null : Number(event.target.value))} placeholder="Sin límite" className={`${inputClass} mt-1`} /><span className="mt-1 block text-xs text-[var(--foreground-muted)]">Dejalo vacío si el grupo no tiene límite.</span></label>
        </div>

        <details className="mt-5 rounded-xl border border-[var(--border-soft)] p-3"><summary className="cursor-pointer font-semibold">Alumnos asignados <span className="text-sm font-normal text-[var(--foreground-muted)]">({form.studentIds.length}{form.capacity === null ? "" : `/${form.capacity}`})</span></summary><p className="mt-2 truncate text-sm text-[var(--foreground-muted)]">{form.studentIds.length ? students.filter((student) => form.studentIds.includes(student.id)).map((student) => `${student.firstName} ${student.lastName}`).join(", ") : "Sin alumnos asignados"}</p>
          <StudentAssignmentOptions detailed students={visibleStudents} query={studentQuery} onQueryChange={setStudentQuery} selectedIds={form.studentIds} toggle={toggle} isDisabled={student => !form.studentIds.includes(student.id) && atCapacity} />
        </details>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} disabled={saving} className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-zinc-300">Cancelar</button><button disabled={saving || (!editing && selectedDays.length === 0)} className="rounded-xl bg-[var(--bm-accent)] px-5 py-3 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{saving ? "Guardando…" : editing ? "Guardar horario" : selectedDays.length === 1 ? "Crear horario" : `Crear ${selectedDays.length} horarios`}</button></div>
      </form>
    </KeyboardDialog>
  );
}
