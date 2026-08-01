"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import type { AttendanceEntry, Payment, Student, TrainingRoutine } from "@/types/gestion";

type Panel = "attendance" | "payments" | "routine" | "classes";
type AttendanceData = { panel: "attendance"; month: string; summary: { attended: number; absent: number; justified: number; percentage: number }; history: AttendanceEntry[] };
type PaymentsData = { panel: "payments"; period: string; payments: Payment[]; obligation: null | { expectedAmount: number; paidAmount: number; balance: number; status: string; dueDate: string }; account: { plan: string; monthlyFee: number; dueDate: string } };
type RoutineData = { panel: "routine"; routine: TrainingRoutine | null };
type ClassesData = { panel: "classes"; schedules: { id: string; dayLabel: string; startTime: string; endTime: string; classType: string }[] };
type PanelData = AttendanceData | PaymentsData | RoutineData | ClassesData;

const actions: { key: Panel; label: string; detail: string }[] = [
  { key: "attendance", label: "Ver asistencias", detail: "Resumen y últimos registros" },
  { key: "payments", label: "Registrar pago", detail: "Cuota, saldo y carga rápida" },
  { key: "routine", label: "Ver rutina", detail: "Rutina activa y ejercicios" },
  { key: "classes", label: "Ver clases", detail: "Horarios activos asignados" },
];

const attendanceStyle = {
  presente: { label: "Presente", className: "bg-emerald-400/15 text-emerald-300" },
  ausente: { label: "Ausente", className: "bg-red-400/15 text-red-300" },
  justificado: { label: "Justificada", className: "bg-yellow-400/15 text-yellow-300" },
} as const;

function money(value: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value); }
function showDate(value: string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin fecha"; }
function monthLabel(value: string) { return value ? new Date(`${value.slice(0, 7)}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : ""; }

export function StudentQuickPanels({ student, initialPanel = null }: { student: Student; initialPanel?: Panel | null }) {
  const [active, setActive] = useState<Panel | null>(initialPanel);
  const [data, setData] = useState<Partial<Record<Panel, PanelData>>>({});
  const [loading, setLoading] = useState<Panel | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Panel, string>>>({});
  const controllers = useRef<Partial<Record<Panel, AbortController>>>({});

  const load = useCallback(async (panel: Panel, refresh = false) => {
    if (!refresh && data[panel]) return;
    controllers.current[panel]?.abort();
    const controller = new AbortController();
    controllers.current[panel] = controller;
    setLoading(panel);
    setErrors((current) => ({ ...current, [panel]: "" }));
    try {
      const response = await fetch(`/api/admin/alumnos/${encodeURIComponent(student.id)}/quick-panel?panel=${panel}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as PanelData | { error?: string };
      if (!response.ok) throw new Error("error" in body ? body.error ?? "No se pudo cargar el panel." : "No se pudo cargar el panel.");
      setData((current) => ({ ...current, [panel]: body as PanelData }));
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setErrors((current) => ({ ...current, [panel]: error.message }));
    } finally {
      if (!controller.signal.aborted) setLoading((current) => current === panel ? null : current);
    }
  }, [data, student.id]);

  useEffect(() => {
    if (active) void load(active);
  }, [active, load]);

  useEffect(() => () => Object.values(controllers.current).forEach((controller) => controller?.abort()), []);

  function toggle(panel: Panel) { setActive((current) => current === panel ? null : panel); }

  return <section className={`mt-6 scroll-mt-24 ${initialPanel === "attendance" ? "rounded-xl ring-2 ring-yellow-300/50" : ""}`}>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {actions.map((action) => <button key={action.key} type="button" aria-expanded={active === action.key} onClick={() => toggle(action.key)} className={`rounded-xl border p-3 text-left transition ${active === action.key ? "border-yellow-400/60 bg-yellow-400/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}><span className={`block text-sm font-bold ${active === action.key ? "text-yellow-300" : "text-zinc-100"}`}>{action.label}</span><span className="mt-1 hidden text-xs text-zinc-500 sm:block">{action.detail}</span></button>)}
    </div>
    {active && <div className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-yellow-300">{actions.find((action) => action.key === active)?.label}</h3><div className="flex items-center gap-1"><button type="button" disabled={loading === active} onClick={() => void load(active, true)} className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50">Actualizar</button><button type="button" onClick={() => setActive(null)} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800">Cerrar</button></div></div>
      {loading === active && !data[active] && <PanelSkeleton />}
      {errors[active] && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p>{errors[active]}</p><button type="button" onClick={() => void load(active, true)} className="mt-3 rounded-lg border border-red-300/40 px-3 py-2 font-bold">Reintentar</button></div>}
      {!errors[active] && data[active]?.panel === "attendance" && <AttendancePanel data={data[active] as AttendanceData} studentId={student.id}/>} 
      {!errors[active] && data[active]?.panel === "payments" && <PaymentsPanel data={data[active] as PaymentsData} student={student} refresh={() => load("payments", true)}/>} 
      {!errors[active] && data[active]?.panel === "routine" && <RoutinePanel data={data[active] as RoutineData} studentId={student.id}/>} 
      {!errors[active] && data[active]?.panel === "classes" && <ClassesPanel data={data[active] as ClassesData}/>} 
    </div>}
  </section>;
}

function PanelSkeleton() { return <div aria-label="Cargando" className="mt-4 space-y-3 animate-pulse"><div className="h-16 rounded-xl bg-zinc-900"/><div className="h-24 rounded-xl bg-zinc-900"/></div>; }

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-zinc-900 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-lg font-bold text-yellow-300">{value}</p></div>; }

function AttendancePanel({ data, studentId }: { data: AttendanceData; studentId: string }) {
  return <div className="mt-4"><p className="text-xs text-zinc-500">Mes actual: {monthLabel(`${data.month}-01`)}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Presentes" value={data.summary.attended}/><Metric label="Ausentes" value={data.summary.absent}/><Metric label="Justificadas" value={data.summary.justified}/><Metric label="Asistencia" value={`${data.summary.percentage}%`}/></div>
    <div className="mt-4 space-y-2">{data.history.length ? data.history.map((entry) => { const status = attendanceStyle[entry.status]; return <article key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div><p className="text-sm font-semibold">{showDate(entry.date)}</p><p className="mt-0.5 text-xs text-zinc-500">{entry.scheduleLabel} · {entry.scheduleStartTime}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></article>; }) : <p className="rounded-xl bg-zinc-900 p-5 text-center text-sm text-zinc-500">Todavía no hay asistencias registradas.</p>}</div>
    <Link href={`/asistencias?studentId=${encodeURIComponent(studentId)}`} className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Ver historial completo →</Link>
  </div>;
}

function PaymentsPanel({ data, student, refresh }: { data: PaymentsData; student: Student; refresh: () => Promise<void> }) {
  const [amount, setAmount] = useState(data.obligation?.balance ? String(data.obligation.balance) : "");
  const [paidDate, setPaidDate] = useState(argentinaDateKey());
  const [period, setPeriod] = useState(data.period.slice(0, 7));
  const [method, setMethod] = useState("Efectivo");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestKey = useRef("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("Ingresá un importe mayor que cero."); return; }
    requestKey.current ||= `student-card-${student.id}-${crypto.randomUUID()}`;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/pagos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id, amount: numericAmount, paidDate, billingPeriod: `${period}-01`, method, notes, requestKey: requestKey.current }) });
      const body = await response.json() as { error?: string; duplicate?: boolean };
      if (!response.ok) throw new Error(body.error ?? "No se pudo registrar el pago.");
      setNotice(body.duplicate ? "El pago ya estaba registrado; no se duplicó." : "Pago registrado correctamente.");
      requestKey.current = "";
      setAmount("");
      setNotes("");
      await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo registrar el pago."); }
    finally { setSaving(false); }
  }

  const lastPayment = data.payments.find((payment) => payment.status !== "anulado");
  return <div className="mt-4"><div className="grid gap-2 sm:grid-cols-3"><Metric label="Plan actual" value={data.account.plan || "Sin plan"}/><Metric label="Último pago" value={lastPayment ? `${money(lastPayment.amount)} · ${showDate(lastPayment.paidDate)}` : "Sin pagos"}/><Metric label="Próximo vencimiento" value={data.account.dueDate ? showDate(data.account.dueDate) : "Sin definir"}/></div>
    {data.obligation ? <div className="mt-3 grid grid-cols-3 gap-2"><Metric label="Esperado" value={money(data.obligation.expectedAmount)}/><Metric label="Pagado" value={money(data.obligation.paidAmount)}/><Metric label="Saldo" value={money(data.obligation.balance)}/></div> : <p className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs text-yellow-200">No hay información de cuota disponible para este período. El importe actual ({money(data.account.monthlyFee)}) es solo informativo y no se usa para reconstruir deuda.</p>}
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Importe<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} className={`${inputClass} mt-1`}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Otro</option></select></label><label className="text-sm">Fecha de pago<input required type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Período<input required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm sm:col-span-2">Observación <span className="text-xs text-zinc-500">(opcional)</span><textarea rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} mt-1`}/></label><p className="text-xs text-zinc-500 sm:col-span-2">El pago se registra con estado Pagado, igual que en el módulo Pagos.</p>
      {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{notice && <p className="sm:col-span-2 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50">{saving ? "Registrando…" : "Registrar pago"}</button><Link href={`/pagos?studentId=${encodeURIComponent(student.id)}`} className="text-sm font-semibold text-yellow-400">Ver historial de pagos →</Link></div>
    </form>
  </div>;
}

function RoutinePanel({ data, studentId }: { data: RoutineData; studentId: string }) {
  const routine = data.routine;
  if (!routine) return <div className="mt-4"><p className="rounded-xl bg-zinc-900 p-5 text-center text-sm text-zinc-500">Este alumno no tiene una rutina activa.</p><Link href={`/rutinas?studentId=${encodeURIComponent(studentId)}`} className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Asignar rutina →</Link></div>;
  return <div className="mt-4"><div className="rounded-xl bg-zinc-900 p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{routine.name}</p><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">Activa</span></div><p className="mt-1 text-sm text-zinc-400">{routine.objective} · {routine.level}{routine.durationWeeks ? ` · ${routine.durationWeeks} semanas` : ""}</p><p className="mt-1 text-xs text-zinc-500">Inicio: {routine.startDate ? showDate(routine.startDate) : "Sin definir"}</p>{routine.description && <p className="mt-2 text-sm text-zinc-300">{routine.description}</p>}</div><div className="mt-3 space-y-2">{routine.days.map((day) => <details key={day.id} className="rounded-xl border border-zinc-800 bg-zinc-900"><summary className="cursor-pointer list-none p-3 font-semibold">Día {day.dayNumber} · {day.name}<span className="ml-2 text-xs font-normal text-zinc-500">{day.exercises.length} ejercicios</span></summary><div className="space-y-2 border-t border-zinc-800 p-3">{day.observations && <p className="rounded-lg bg-zinc-950 p-2 text-xs text-zinc-400">{day.observations}</p>}{day.exercises.map((exercise) => <div key={exercise.id} className="text-sm"><p className="font-medium">{exercise.name}</p><p className="text-xs text-zinc-500">{exercise.sets} series · {exercise.repetitions}{exercise.restSeconds ? ` · ${exercise.restSeconds}s descanso` : ""}</p>{exercise.observations && <p className="mt-1 text-xs text-zinc-400">{exercise.observations}</p>}</div>)}</div></details>)}</div><div className="mt-4 flex flex-wrap gap-4"><Link href={`/rutinas?studentId=${encodeURIComponent(studentId)}&view=active`} className="text-sm font-semibold text-yellow-400">Ver rutina completa →</Link><Link href={`/rutinas?studentId=${encodeURIComponent(studentId)}`} className="text-sm font-semibold text-yellow-400">Editar rutina →</Link></div></div>;
}

function ClassesPanel({ data }: { data: ClassesData }) {
  return <div className="mt-4"><div className="space-y-2">{data.schedules.length ? data.schedules.map((schedule) => <article key={schedule.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{schedule.dayLabel}</p><p className="mt-1 text-sm text-zinc-400">{schedule.classType}</p><p className="mt-1 text-[11px] font-bold uppercase text-emerald-300">Horario activo</p></div><p className="whitespace-nowrap text-sm font-bold text-yellow-300">{schedule.startTime}–{schedule.endTime}</p></div></article>) : <p className="rounded-xl bg-zinc-900 p-5 text-center text-sm text-zinc-500">Este alumno no tiene horarios semanales asignados.</p>}</div><Link href="/clases" className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Gestionar clases →</Link></div>;
}
