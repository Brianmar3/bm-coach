"use client";
import type { RoutineInput } from "@/lib/rutinas";
import { routineReview, type RoutineReviewError } from "@/lib/routine-review";

export function RoutineReview({ form, saving, updating, close, correct }: { form: RoutineInput; saving: boolean; updating: boolean; close: () => void; correct: (issue: RoutineReviewError) => void }) {
  const review = routineReview(form);
  return <div className="routine-review">
    <div className="routine-review-summary" data-state={review.errors.length ? "error" : review.warnings.length ? "warning" : "ready"} role="status"><strong>{review.summary}</strong><p>{review.errors.length ? "Corregí los errores bloqueantes antes de activar." : "Las advertencias no bloquean la activación."}</p></div>
    <p className="routine-review-count">{form.days.length} días · {form.days.reduce((sum, day) => sum + (day.blocks?.reduce((count, block) => count + block.exercises.length, 0) ?? day.exercises.length), 0)} ejercicios</p>
    <div className="routine-review-list">
      {review.errors.length > 0 && <section aria-label="Errores bloqueantes"><h3>Errores bloqueantes ({review.errors.length})</h3><ul>{review.errors.map((issue, index) => <li key={`${issue.key}-${index}`}><button type="button" className="routine-review-issue" data-severity="error" onClick={() => correct(issue)}><span aria-hidden="true">!</span><span><strong>{issue.location}</strong><span>{issue.message === "Ingresá el grupo muscular." ? "Falta grupo muscular" : issue.message === "Ingresá el nombre del ejercicio." ? "Falta nombre del ejercicio" : issue.message}</span><small>Ir a corregir</small></span></button></li>)}</ul></section>}
      {review.warnings.length > 0 && <section aria-label="Advertencias"><h3>Advertencias ({review.warnings.length})</h3><ul>{review.warnings.map(warning => <li key={warning.key} className="routine-review-issue" data-severity="warning"><span aria-hidden="true">!</span><span><strong>{warning.location}</strong><span>{warning.message}</span></span></li>)}</ul></section>}
      {!form.studentIds.length && <p className="routine-review-count">Rutina sin asignar. Podés asignar alumnos después.</p>}
    </div>
    <div className="routine-dialog-actions"><button type="button" disabled={saving} onClick={() => review.errors[0] ? correct(review.errors[0]) : close()} className={review.errors.length ? "routine-primary" : ""}>{review.errors.length ? "Corregir errores" : "Seguir editando"}</button><button type="submit" name="intent" value="activate" className="routine-primary" aria-describedby={review.errors.length ? "routine-review-blocked" : undefined} disabled={saving || !review.canActivate}>{saving ? "Guardando…" : updating ? "Confirmar actualización" : "Activar rutina"}</button></div>
    {review.errors.length > 0 && <p id="routine-review-blocked" className="routine-review-blocked">Activación bloqueada: corregí los errores indicados.</p>}
  </div>;
}
