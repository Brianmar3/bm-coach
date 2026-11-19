"use client";

import { useState } from "react";
import { KeyboardDialog } from "@/componentes/keyboard-dialog";
import { inputClass } from "@/componentes/module-shell";
import { parseQuickStudentLine, quickStudentIssue, type QuickStudentRow } from "@/lib/quick-student-enrollment";
import { StudentBulkPlan } from "@/componentes/student-bulk-plan";
import type { Student, StudentPlanOption } from "@/types/gestion";

type PreviewRow = QuickStudentRow & { id: number; selected: boolean; ambiguous: boolean; confirmed: boolean };

export function QuickStudentEnrollment({ existing, plans, close, created, updated }: { existing: Student[]; plans: StudentPlanOption[]; close: () => void; created: (students: Student[]) => void; updated: (students: Student[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Student[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const existingNames = existing.map((item) => ({ firstName: item.firstName, lastName: item.lastName, phone: item.phone }));
  function preview() {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 50) { setError("Podés cargar hasta 50 alumnos por vez."); return; }
    setRows(lines.map((line, index) => ({ ...parseQuickStudentLine(line), id: index, selected: true, ambiguous: parseQuickStudentLine(line).lastName.split(" ").length > 1, confirmed: false })));
    setError(lines.length ? "" : "Escribí al menos un alumno.");
  }
  function change(id: number, key: keyof QuickStudentRow, value: string) { setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row)); }
  const selected = rows.filter((row) => row.selected);
  const issues = selected.map((row, index) => row.ambiguous && !row.confirmed ? "Confirmá cómo se separan nombre y apellido." : quickStudentIssue(row, existingNames, selected.slice(0, index)));
  async function save() {
    if (!selected.length || issues.some(Boolean) || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/alumnos/carga-rapida", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: selected.map(({ firstName, lastName, phone }) => ({ firstName, lastName, phone })) }) });
      const result = await response.json() as { students?: Student[]; error?: string };
      if (!response.ok || !result.students) throw new Error(result.error || "No se pudo guardar la lista.");
      created(result.students);
      setSaved(result.students);
      setSelectedSaved(result.students.map((student) => student.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la lista."); }
    finally { setSaving(false); }
  }
  if (saved.length) return <>
    <KeyboardDialog as="section" onClose={close} role="dialog" aria-modal="true" aria-label="Resultado de carga rápida" className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--background)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:inset-[5vh_50%_auto_auto] sm:max-h-[90dvh] sm:w-[min(92vw,46rem)] sm:translate-x-1/2 sm:rounded-2xl sm:border sm:border-[var(--border-soft)] sm:bg-[var(--surface-elevated)] sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">Carga rápida</p><h2 className="mt-1 text-xl font-bold">{saved.length} alumnos incorporados</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">Podés activar algunos ahora o finalizar y completar sus fichas más adelante.</p>
      {success && <p role="status" className="mt-4 rounded-xl border border-[var(--success)]/40 p-3 text-sm text-[var(--success)]">{success}</p>}
      <label className="mt-5 flex min-h-11 items-center gap-3 border-b border-[var(--border-soft)] text-sm font-semibold"><input type="checkbox" checked={selectedSaved.length === saved.length} onChange={(event) => setSelectedSaved(event.target.checked ? saved.map((student) => student.id) : [])}/>Seleccionar todos</label>
      <div className="max-h-[45dvh] overflow-y-auto">{saved.map((student) => <label key={student.id} className="flex min-h-12 items-center gap-3 border-b border-[var(--border-soft)] text-sm"><input type="checkbox" checked={selectedSaved.includes(student.id)} onChange={(event) => setSelectedSaved((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))}/><span className="min-w-0 flex-1 truncate">{student.firstName} {student.lastName}</span><span className="text-xs text-[var(--foreground-muted)]">{student.status === "activo" ? "Activo" : "Inactivo"}</span></label>)}</div>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!selectedSaved.length} onClick={() => setBulkOpen(true)} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">Asignar plan y activar</button><button type="button" onClick={close} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-5">Finalizar</button></div>
    </KeyboardDialog>
    {bulkOpen && <StudentBulkPlan students={saved.filter((student) => selectedSaved.includes(student.id))} plans={plans} close={() => setBulkOpen(false)} applied={(students) => { const byId = new Map(students.map((student) => [student.id, student])); setSaved((current) => current.map((student) => byId.get(student.id) ?? student)); setSelectedSaved([]); setBulkOpen(false); setSuccess(`${students.length} alumnos activados con plan.`); updated(students); }}/>}</>;
  return <KeyboardDialog as="section" onClose={close} dismissible={!saving} role="dialog" aria-modal="true" aria-label="Carga rápida de alumnos" className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--background)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:inset-[5vh_50%_auto_auto] sm:max-h-[90dvh] sm:w-[min(92vw,46rem)] sm:translate-x-1/2 sm:rounded-2xl sm:border sm:border-[var(--border-soft)] sm:bg-[var(--surface-elevated)] sm:p-6">
    <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">Alumnos</p><h2 className="mt-1 text-xl font-bold">Carga rápida</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">Un alumno por línea. Teléfono opcional, separado por coma.</p></div><button type="button" onClick={close} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-3">Cerrar</button></header>
    {!rows.length ? <><textarea autoFocus rows={10} value={text} onChange={(event) => setText(event.target.value)} placeholder={"Ana Pérez, 3411234567\nJuan Gómez"} className={`${inputClass} mt-5 min-h-56`} /><button type="button" onClick={preview} className="mt-4 min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)]">Revisar alumnos</button></> : <><div className="mt-5 space-y-3">{rows.map((row) => { const prior = selected.filter((item) => item.id < row.id); const issue = row.selected ? row.ambiguous && !row.confirmed ? "Confirmá cómo se separan nombre y apellido." : quickStudentIssue(row, existingNames, prior) : null; return <div key={row.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={row.selected} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item))} /> Incluir línea {row.id + 1}</label><div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label={`Nombre línea ${row.id + 1}`} value={row.firstName} onChange={(event) => change(row.id, "firstName", event.target.value)} placeholder="Nombre" className={inputClass} /><input aria-label={`Apellido línea ${row.id + 1}`} value={row.lastName} onChange={(event) => change(row.id, "lastName", event.target.value)} placeholder="Apellido" className={inputClass} /><input aria-label={`Teléfono línea ${row.id + 1}`} value={row.phone} onChange={(event) => change(row.id, "phone", event.target.value)} placeholder="Teléfono opcional" className={inputClass} /></div>{row.ambiguous && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={row.confirmed} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, confirmed: event.target.checked } : item))} /> Confirmé nombre y apellido</label>}{issue && <p className="mt-2 text-xs text-[var(--warning)]">{issue}</p>}</div>; })}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setRows([])} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4">Editar texto</button><button type="button" disabled={!selected.length || issues.some(Boolean) || saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{saving ? "Guardando…" : `Guardar ${selected.length} alumnos`}</button></div><p className="mt-3 text-xs text-[var(--foreground-muted)]">Se guardarán como fichas inactivas sin plan ni acceso. Completá cada ficha antes de activarla.</p></>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </KeyboardDialog>;
}
