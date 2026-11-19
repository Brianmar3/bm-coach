"use client";

import { useState } from "react";
import { KeyboardDialog } from "@/componentes/keyboard-dialog";
import { inputClass } from "@/componentes/module-shell";
import { STUDENT_SERVICE_OPTIONS } from "@/lib/student-service";
import type { Student, StudentPlanOption, StudentServiceType } from "@/types/gestion";

const money = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);

export function StudentBulkPlan({ students, plans, close, applied }: {
  students: Student[];
  plans: StudentPlanOption[];
  close: () => void;
  applied: (students: Student[]) => void;
}) {
  const [planKey, setPlanKey] = useState("");
  const [serviceType, setServiceType] = useState<"" | StudentServiceType>("");
  const [dueDate, setDueDate] = useState("");
  const [review, setReview] = useState(false);
  const [confirmFinancial, setConfirmFinancial] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const plan = plans.find((item) => item.selectionKey === planKey);
  const overwritten = students.filter((student) =>
    (Boolean(student.plan || student.planId) && (student.planId !== plan?.persistentId || student.plan !== plan?.name)) ||
    Boolean(serviceType && serviceType !== student.serviceType) ||
    Boolean(dueDate && student.dueDate && dueDate !== student.dueDate));
  const ready = Boolean(plan && (!plan.price || confirmFinancial) && (!overwritten.length || confirmOverwrite));
  async function save() {
    if (!ready || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/alumnos/acciones-masivas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: students.map((student) => student.id), planSelectionKey: planKey, serviceType: serviceType || undefined, dueDate: dueDate || undefined, confirmFinancial, confirmOverwrite }),
      });
      const result = await response.json() as { students?: Student[]; error?: string };
      if (!response.ok || !result.students) throw new Error(result.error || "No se pudieron actualizar los alumnos.");
      applied(result.students);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron actualizar los alumnos."); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[130] grid place-items-end bg-black/80 sm:place-items-center sm:p-4">
    <KeyboardDialog as="section" onClose={close} dismissible={!saving} priority={90} role="dialog" aria-modal="true" aria-label="Asignar plan y activar" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:rounded-2xl sm:p-6">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">Alumnos seleccionados: {students.length}</p><h2 className="mt-1 text-xl font-bold">Asignar plan y activar</h2></div><button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-3">Cerrar</button></header>
      {!review ? <div className="mt-5 space-y-4">
        <label className="block text-sm">Plan configurado<select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={`${inputClass} mt-1`}><option value="">Seleccionar plan</option>{plans.map((option) => <option key={option.selectionKey} value={option.selectionKey}>{option.name} · {money(option.price)}{option.frequencyDays ? ` · ${option.frequencyDays} días` : ""}</option>)}</select></label>
        <label className="block text-sm">Servicio<select value={serviceType} onChange={(event) => setServiceType(event.target.value as "" | StudentServiceType)} className={`${inputClass} mt-1`}><option value="">Conservar servicio actual</option>{STUDENT_SERVICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="block text-sm">Próximo vencimiento <span className="text-[var(--foreground-muted)]">(opcional)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${inputClass} mt-1`} /><span className="mt-1 block text-xs text-[var(--foreground-muted)]">Si lo dejás vacío, se conserva el vencimiento actual; las fichas nuevas quedan sin vencimiento.</span></label>
        {!plans.length && <p role="alert" className="text-sm text-[var(--warning)]">Configurá un plan en Configuración antes de activar alumnos.</p>}
        <button type="button" disabled={!plan} onClick={() => setReview(true)} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">Revisar cambios</button>
      </div> : <div className="mt-5 space-y-4 text-sm">
        <p>Se activarán <strong>{students.length} alumnos</strong> con el plan <strong>{plan?.name}</strong>, cuota <strong>{money(plan?.price ?? 0)}</strong>{plan?.frequencyDays ? ` y frecuencia de ${plan.frequencyDays} días por semana` : ""}.</p>
        <p className="text-[var(--foreground-muted)]">{dueDate ? `Vencimiento seleccionado: ${dueDate}.` : "Los vencimientos existentes se conservarán; los nuevos seguirán sin definir."} No se registrarán pagos ni se crearán accesos al portal.</p>
        {overwritten.length > 0 && <label className="flex items-start gap-2 rounded-xl border border-[var(--warning)]/40 p-3"><input type="checkbox" checked={confirmOverwrite} onChange={(event) => setConfirmOverwrite(event.target.checked)} className="mt-1"/><span>Confirmo reemplazar el plan, servicio o vencimiento actual de {overwritten.length} alumno{overwritten.length === 1 ? "" : "s"}.</span></label>}
        {(plan?.price ?? 0) > 0 && <label className="flex items-start gap-2 rounded-xl border border-[var(--warning)]/40 p-3"><input type="checkbox" checked={confirmFinancial} onChange={(event) => setConfirmFinancial(event.target.checked)} className="mt-1"/><span>Confirmo la cuota de {money(plan!.price)} por alumno. La activación puede generar obligaciones de pago según las reglas existentes.</span></label>}
        <div className="max-h-32 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-3 text-[var(--foreground-muted)]">{students.map((student) => <p key={student.id}>{student.firstName} {student.lastName}</p>)}</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setReview(false)} disabled={saving} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4">Volver</button><button type="button" onClick={() => void save()} disabled={!ready || saving} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{saving ? "Aplicando…" : "Confirmar y activar"}</button></div>
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p>}
    </KeyboardDialog>
  </div>;
}
