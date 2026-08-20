import type { TrainingRoutine } from "../types/gestion.ts";
import { isReusableCompleteClass } from "./class-template-base.ts";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function matchesSearch(routine: TrainingRoutine, search: string) {
  const term = normalized(search);
  if (!term) return true;
  return normalized([routine.name, routine.objective, routine.description, ...routine.tags, ...routine.historicalStudents.map((student) => student.name)].join(" ")).includes(term);
}

export function routineCreationClasses(routines: TrainingRoutine[], search = "", objective = "todos") {
  return routines.filter((routine) => isReusableCompleteClass(routine) && routine.status !== "archivada" && matchesSearch(routine, search) && (objective === "todos" || routine.objective === objective));
}

export function routineCreationSources(routines: TrainingRoutine[], search = "", objective = "todos") {
  return routines.filter((routine) => routine.kind === "assigned" && (routine.status === "activa" || routine.status === "archivada") && matchesSearch(routine, search) && (objective === "todos" || routine.objective === objective));
}

export function cleanRoutineCopyName(name: string) {
  const base = name.replace(/^(?:\s*Copia de\s+)+/i, "").replace(/(?:\s*\(\s*copia(?:\s+\d+)?\s*\))+\s*$/gi, "").trim();
  return `Copia de ${base || "rutina"}`;
}
