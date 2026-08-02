import type { PortalWorkoutSession } from "../types/portal.ts";
import { isDateKey } from "./payment-dates.ts";

export const GENERAL_FEELINGS = ["Muy buena", "Buena", "Normal", "Difícil", "Muy difícil"] as const;
export type PortalGeneralFeeling = typeof GENERAL_FEELINGS[number];

function rating(value: number | null | undefined) {
  return value == null || (Number.isInteger(value) && value >= 1 && value <= 5);
}

export function resolveGeneralFeeling(input: Pick<PortalWorkoutSession, "generalFeeling" | "finalComment">) {
  if (input.generalFeeling && GENERAL_FEELINGS.includes(input.generalFeeling)) return input.generalFeeling;
  const historical = input.finalComment.match(/^Sensación general:\s*([^\n]+)/i)?.[1]?.trim();
  return GENERAL_FEELINGS.find((feeling) => feeling.toLocaleLowerCase("es") === historical?.toLocaleLowerCase("es")) ?? null;
}

export function validateWorkoutSessionInput(input: PortalWorkoutSession) {
  if (!input.routineId || !input.dayId || !isDateKey(input.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return "Completá rutina, día, fecha y hora.";
  if (input.durationMinutes !== null && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440)) return "La duración debe estar entre 1 y 1440 minutos.";
  if (![input.energyBefore, input.difficulty, input.energyAfter].every(rating)) return "Las escalas históricas de energía y dificultad deben estar entre 1 y 5.";
  if (input.hasPain && !input.painDetails.trim()) return "Contanos dónde sentís dolor o molestia.";
  if (!Array.isArray(input.exercises)) return "Los ejercicios no son válidos.";
  if (input.status === "finalizado" && input.durationMinutes === null) return "Para finalizar, completá la duración.";
  if (input.status === "finalizado" && !resolveGeneralFeeling(input)) return "Para finalizar, seleccioná una sensación general válida.";
  if (input.status === "finalizado" && !input.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) return "Marcá al menos una serie como completada antes de finalizar.";
  if (input.finalComment.length > 2000 || input.painDetails.length > 1000) return "El comentario es demasiado extenso.";
  if (!["pendiente", "en_progreso", "finalizado"].includes(input.status)) return "El estado no es válido.";
  for (const exercise of input.exercises) {
    if (!exercise.exerciseId || exercise.observation.length > 1000 || !Array.isArray(exercise.sets)) return "Los datos del ejercicio no son válidos.";
    for (const set of exercise.sets) {
      if (!Number.isInteger(set.setNumber) || set.setNumber < 1 || set.setNumber > 100) return "El número de serie no es válido.";
      if (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000)) return "El peso debe estar entre 0 y 1000 kg.";
      if (set.repetitions !== null && (!Number.isInteger(set.repetitions) || set.repetitions < 0 || set.repetitions > 1000)) return "Las repeticiones no son válidas.";
      if (set.effort !== null && (!Number.isFinite(set.effort) || set.effort < 0 || set.effort > 10)) return "El esfuerzo debe estar entre 0 y 10.";
      if (set.observation.length > 500) return "La observación de una serie es demasiado extensa.";
    }
  }
  return null;
}
