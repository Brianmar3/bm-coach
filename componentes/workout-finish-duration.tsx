"use client";

import { useState } from "react";
import { WORKOUT_MAX_DURATION_MINUTES, workoutDurationError } from "@/lib/workout-session-validation";

export function WorkoutFinishDuration({ minutes, disabled, onChange }: { minutes: number | null; disabled: boolean; onChange: (minutes: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const error = workoutDurationError(minutes);
  const exceeded = minutes !== null && minutes > WORKOUT_MAX_DURATION_MINUTES;
  return <div className="mb-3 border-b border-[var(--input-border)] pb-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-[var(--foreground-muted)]">Tiempo trabajado</p><p className="text-lg font-bold text-[var(--brand-text)]">{minutes ?? "—"} min</p></div><button type="button" disabled={disabled} aria-expanded={editing} aria-controls="workout-finish-minutes" onClick={() => setEditing(value => !value)} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-[var(--brand-text)] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] disabled:opacity-50">{editing ? "Listo" : "Editar tiempo"}</button></div>
    {editing && <label className="mt-2 block text-xs text-[var(--foreground-muted)]">Duración (min)<input id="workout-finish-minutes" autoFocus type="number" inputMode="numeric" min={1} max={WORKOUT_MAX_DURATION_MINUTES} step={1} disabled={disabled} value={minutes ?? ""} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} aria-invalid={Boolean(error)} aria-describedby={error ? "workout-duration-error" : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-base text-[var(--foreground)] outline-none focus:border-yellow-400"/></label>}
    {(error || minutes === null) && <p id="workout-duration-error" role="alert" className="mt-2 text-xs text-[var(--error-text,var(--foreground))]">{exceeded ? `No se puede guardar: superaste el tiempo máximo permitido. Máximo: ${WORKOUT_MAX_DURATION_MINUTES} minutos. Usá Editar tiempo para corregirlo.` : error ?? "Para finalizar, completá la duración con Editar tiempo."}</p>}
  </div>;
}
