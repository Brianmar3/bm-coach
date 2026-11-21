"use client";

import { useState } from "react";
import { KeyboardDialog } from "@/componentes/keyboard-dialog";
import { inputClass } from "@/componentes/module-shell";
import { parseQuickStudentLine, quickStudentIssue, type QuickStudentRow } from "@/lib/quick-student-enrollment";
import { STUDENT_SERVICE_OPTIONS } from "@/lib/student-service";
import type { Student, StudentPlanOption, StudentServiceType } from "@/types/gestion";

type PreviewRow = QuickStudentRow & {
  id: number;
  selected: boolean;
  ambiguous: boolean;
  confirmed: boolean;
};
type EnrollmentMode = "active" | "inactive";

const money = (amount: number) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
}).format(amount);

export function QuickStudentEnrollment({
  existing,
  plans,
  close,
  created,
}: {
  existing: Student[];
  plans: StudentPlanOption[];
  close: () => void;
  created: (students: Student[]) => void;
  updated: (students: Student[]) => void;
}) {
  const [step, setStep] = useState<"entry" | "review" | "done">("entry");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [mode, setMode] = useState<EnrollmentMode>("active");
  const [planKey, setPlanKey] = useState("");
  const [serviceType, setServiceType] = useState<StudentServiceType>("CLASSES");
  const [dueDate, setDueDate] = useState("");
  const [confirmFinancial, setConfirmFinancial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Student[]>([]);

  const selectedPlan = plans.find((plan) => plan.selectionKey === planKey);
  const existingNames = existing.map((student) => ({
    firstName: student.firstName,
    lastName: student.lastName,
    phone: student.phone,
  }));
  const selected = rows.filter((row) => row.selected);
  const issues = selected.map((row, index) => row.ambiguous && !row.confirmed
    ? "Confirmá cómo se separan nombre y apellido."
    : quickStudentIssue(row, existingNames, selected.slice(0, index)));
  const canSave = selected.length > 0
    && !issues.some(Boolean)
    && (mode === "inactive" || (Boolean(selectedPlan) && (!(selectedPlan?.price ?? 0) || confirmFinancial)))
    && !saving;

  function preview() {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 50) {
      setError("Podés cargar hasta 50 alumnos por vez.");
      return;
    }
    if (!lines.length) {
      setError("Escribí al menos un alumno.");
      return;
    }
    if (mode === "active" && !selectedPlan) {
      setError("Seleccioná un plan para incorporar alumnos activos.");
      return;
    }
    setRows(lines.map((line, index) => {
      const parsed = parseQuickStudentLine(line);
      return {
        ...parsed,
        id: index,
        selected: true,
        ambiguous: parsed.lastName.split(" ").filter(Boolean).length > 1,
        confirmed: false,
      };
    }));
    setConfirmFinancial(false);
    setError("");
    setStep("review");
  }

  function change(id: number, key: keyof QuickStudentRow, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/alumnos/carga-rapida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: selected.map(({ firstName, lastName, phone }) => ({ firstName, lastName, phone })),
          mode,
          ...(mode === "active" ? {
            planSelectionKey: planKey,
            serviceType,
            dueDate: dueDate || undefined,
            confirmFinancial,
          } : {}),
        }),
      });
      const result = await response.json() as { students?: Student[]; error?: string };
      if (!response.ok || !result.students) throw new Error(result.error || "No se pudieron guardar los alumnos.");
      created(result.students);
      setSaved(result.students);
      setStep("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los alumnos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardDialog
      as="section"
      onClose={close}
      dismissible={!saving}
      role="dialog"
      aria-modal="true"
      aria-label="Carga rápida de alumnos"
      className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--background)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:inset-[5vh_50%_auto_auto] sm:max-h-[90dvh] sm:w-[min(92vw,46rem)] sm:translate-x-1/2 sm:rounded-2xl sm:border sm:border-[var(--border-soft)] sm:bg-[var(--surface-elevated)] sm:p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">
            Alumnos · {step === "entry" ? "Paso 1 de 2" : step === "review" ? "Paso 2 de 2" : "Completado"}
          </p>
          <h2 className="mt-1 text-xl font-bold">Carga rápida</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            {step === "entry" ? "Pegá los alumnos y elegí cómo incorporarlos." : step === "review" ? "Revisá los datos antes de guardarlos." : "La carga terminó correctamente."}
          </p>
        </div>
        <button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-3">Cerrar</button>
      </header>

      {step === "entry" && (
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Alumnos (uno por línea)
            <textarea
              autoFocus
              rows={7}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"Ana Pérez, 3411234567\nJuan Gómez"}
              className={`${inputClass} mt-2 min-h-40`}
            />
            <span className="mt-1 block text-xs font-normal text-[var(--foreground-muted)]">Teléfono opcional, separado por coma. Hasta 50 alumnos.</span>
          </label>

          <fieldset className="rounded-xl border border-[var(--border-soft)] p-3">
            <legend className="px-1 text-sm font-semibold">Incorporar como</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="quick-mode" checked={mode === "active"} onChange={() => setMode("active")}/>
              Activos con plan (recomendado)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="quick-mode" checked={mode === "inactive"} onChange={() => setMode("inactive")}/>
              Inactivos sin plan
            </label>
          </fieldset>

          {mode === "active" && (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
              <label className="block text-sm font-semibold">
                Plan configurado
                <select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Seleccionar plan</option>
                  {plans.map((plan) => <option key={plan.selectionKey} value={plan.selectionKey}>
                    {plan.name} · {money(plan.price)}{plan.frequencyDays ? ` · ${plan.frequencyDays} días` : ""}
                  </option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Servicio
                <select value={serviceType} onChange={(event) => setServiceType(event.target.value as StudentServiceType)} className={`${inputClass} mt-1`}>
                  {STUDENT_SERVICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Próximo vencimiento (opcional)
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${inputClass} mt-1`}/>
              </label>
              {!plans.length && <p role="alert" className="text-sm text-[var(--warning)]">Configurá un plan en Configuración antes de activar alumnos.</p>}
            </div>
          )}

          <button type="button" disabled={!text.trim() || (mode === "active" && !selectedPlan)} onClick={preview} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">
            Revisar alumnos
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-sm">
            <p className="font-semibold">{selected.length} alumnos seleccionados · {mode === "active" ? "Activos con plan" : "Inactivos sin plan"}</p>
            {mode === "active" && <p className="mt-1 text-[var(--foreground-muted)]">{selectedPlan?.name} · {money(selectedPlan?.price ?? 0)} por alumno{dueDate ? ` · Vence ${dueDate}` : " · Sin vencimiento definido"}</p>}
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">No se crearán accesos al portal ni se registrarán pagos.</p>
          </div>

          <div className="max-h-[48dvh] space-y-3 overflow-y-auto pr-1">
            {rows.map((row) => {
              const previous = selected.filter((item) => item.id < row.id);
              const issue = row.selected ? row.ambiguous && !row.confirmed
                ? "Confirmá cómo se separan nombre y apellido."
                : quickStudentIssue(row, existingNames, previous) : null;
              return (
                <div key={row.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                  <label className="flex min-h-9 items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={row.selected} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item))}/>
                    Incluir línea {row.id + 1}
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input aria-label={`Nombre línea ${row.id + 1}`} value={row.firstName} onChange={(event) => change(row.id, "firstName", event.target.value)} placeholder="Nombre" className={inputClass}/>
                    <input aria-label={`Apellido línea ${row.id + 1}`} value={row.lastName} onChange={(event) => change(row.id, "lastName", event.target.value)} placeholder="Apellido" className={inputClass}/>
                    <input aria-label={`Teléfono línea ${row.id + 1}`} value={row.phone} onChange={(event) => change(row.id, "phone", event.target.value)} placeholder="Teléfono opcional" className={inputClass}/>
                  </div>
                  {row.ambiguous && <label className="mt-2 flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={row.confirmed} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, confirmed: event.target.checked } : item))}/>
                    Confirmé nombre y apellido
                  </label>}
                  {issue && <p className="mt-2 text-xs text-[var(--warning)]">{issue}</p>}
                </div>
              );
            })}
          </div>

          {mode === "active" && (selectedPlan?.price ?? 0) > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/40 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmFinancial} onChange={(event) => setConfirmFinancial(event.target.checked)}/>
              <span>Confirmo la cuota de {money(selectedPlan!.price)} por alumno. La activación puede generar obligaciones de pago según las reglas existentes.</span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => { setStep("entry"); setConfirmFinancial(false); }} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4">Volver</button>
            <button type="button" disabled={!canSave} onClick={() => void save()} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">
              {saving ? "Guardando…" : mode === "active" ? `Guardar y activar ${selected.length}` : `Guardar ${selected.length} inactivos`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-5 space-y-4">
          <p role="status" className="rounded-xl border border-[var(--success)]/40 p-3 text-sm text-[var(--success)]">
            {saved.length} alumnos incorporados {mode === "active" ? "y activados con plan" : "como inactivos sin plan"}.
          </p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-3 text-sm">
            {saved.map((student) => <p key={student.id} className="py-1">{student.firstName} {student.lastName} · {student.status === "activo" ? "Activo" : "Inactivo"}</p>)}
          </div>
          <button type="button" onClick={close} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)]">Finalizar</button>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p>}
    </KeyboardDialog>
  );
}
