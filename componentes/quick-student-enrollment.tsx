"use client";

import { useState } from "react";
import { KeyboardDialog } from "@/componentes/keyboard-dialog";
import { inputClass } from "@/componentes/module-shell";
import { parseQuickStudentLine, quickStudentIssue, type QuickStudentRow } from "@/lib/quick-student-enrollment";
import type { Student } from "@/types/gestion";

type PreviewRow = QuickStudentRow & { id: number; selected: boolean; ambiguous: boolean; confirmed: boolean };

export function QuickStudentEnrollment({ existing, close, created }: { existing: Student[]; close: () => void; created: (students: Student[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la lista."); }
    finally { setSaving(false); }
  }
  return <KeyboardDialog as="section" onClose={close} dismissible={!saving} role="dialog" aria-modal="true" aria-label="Carga rápida de alumnos" className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--background)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:inset-[5vh_50%_auto_auto] sm:max-h-[90dvh] sm:w-[min(92vw,46rem)] sm:translate-x-1/2 sm:rounded-2xl sm:border sm:border-[var(--border-soft)] sm:bg-[var(--surface-elevated)] sm:p-6">
    <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">Alumnos</p><h2 className="mt-1 text-xl font-bold">Carga rápida</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">Un alumno por línea. Teléfono opcional, separado por coma.</p></div><button type="button" onClick={close} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-3">Cerrar</button></header>
    {!rows.length ? <><textarea autoFocus rows={10} value={text} onChange={(event) => setText(event.target.value)} placeholder={"Ana Pérez, 3411234567\nJuan Gómez"} className={`${inputClass} mt-5 min-h-56`} /><button type="button" onClick={preview} className="mt-4 min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)]">Revisar alumnos</button></> : <><div className="mt-5 space-y-3">{rows.map((row) => { const prior = selected.filter((item) => item.id < row.id); const issue = row.selected ? row.ambiguous && !row.confirmed ? "Confirmá cómo se separan nombre y apellido." : quickStudentIssue(row, existingNames, prior) : null; return <div key={row.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={row.selected} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item))} /> Incluir línea {row.id + 1}</label><div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label={`Nombre línea ${row.id + 1}`} value={row.firstName} onChange={(event) => change(row.id, "firstName", event.target.value)} placeholder="Nombre" className={inputClass} /><input aria-label={`Apellido línea ${row.id + 1}`} value={row.lastName} onChange={(event) => change(row.id, "lastName", event.target.value)} placeholder="Apellido" className={inputClass} /><input aria-label={`Teléfono línea ${row.id + 1}`} value={row.phone} onChange={(event) => change(row.id, "phone", event.target.value)} placeholder="Teléfono opcional" className={inputClass} /></div>{row.ambiguous && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={row.confirmed} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, confirmed: event.target.checked } : item))} /> Confirmé nombre y apellido</label>}{issue && <p className="mt-2 text-xs text-[var(--warning)]">{issue}</p>}</div>; })}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setRows([])} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4">Editar texto</button><button type="button" disabled={!selected.length || issues.some(Boolean) || saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{saving ? "Guardando…" : `Guardar ${selected.length} alumnos`}</button></div><p className="mt-3 text-xs text-[var(--foreground-muted)]">Se guardarán como fichas inactivas sin plan ni acceso. Completá cada ficha antes de activarla.</p></>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </KeyboardDialog>;
}
