import { routineValidationIssues, type RoutineInput, type RoutineValidationIssue } from "./rutinas.ts";

export type RoutineReviewError = RoutineValidationIssue & { location: string };
export function routineReview(input: RoutineInput) {
  const errors: RoutineReviewError[] = routineValidationIssues(input).map(issue => {
    const match = /^day\.(\d+)(?:\.block\.(\d+))?(?:\.exercise\.(\d+))?/.exec(issue.key);
    const day = match ? input.days.find(day => day.dayNumber === Number(match[1])) : undefined;
    const block = match?.[2] ? day?.blocks?.find(block => block.order === Number(match[2])) : undefined;
    return { ...issue, location: match ? [`Día ${match[1]}`, block?.name || (match[2] ? `Bloque ${match[2]}` : ""), match[3] ? `Ejercicio ${match[3]}` : ""].filter(Boolean).join(" · ") : "Datos de la rutina" };
  });
  const warnings: { key: string; location: string; message: string }[] = [];
  for (const day of input.days) {
    const blocks = day.blocks ?? [];
    if (!blocks.reduce((sum, block) => sum + block.exercises.length, 0) && !day.exercises?.length) warnings.push({ key: `empty-day-${day.dayNumber}`, location: `Día ${day.dayNumber}`, message: "Todavía no tiene ejercicios." });
    for (const block of blocks) if (!block.exercises.length) warnings.push({ key: `empty-block-${day.dayNumber}-${block.order}`, location: `Día ${day.dayNumber} · ${block.name || "Bloque"}`, message: "El bloque está vacío." });
  }
  return { errors, warnings, canActivate: errors.length === 0, summary: errors.length ? `${errors.length} ${errors.length === 1 ? "error por corregir" : "errores por corregir"}` : warnings.length ? `La rutina puede activarse, con ${warnings.length} ${warnings.length === 1 ? "advertencia" : "advertencias"}.` : "Rutina lista para activar." };
}
