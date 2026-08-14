import type { TrainingRoutine } from "@/types/gestion";

export type RoutineStatusSection = "activas" | "borradores" | "archivadas";

const statusBySection: Record<RoutineStatusSection, TrainingRoutine["status"]> = {
  activas: "activa",
  borradores: "borrador",
  archivadas: "archivada",
};

export function routineStatusCounts(routines: TrainingRoutine[]) {
  const assigned = routines.filter((routine) => routine.kind === "assigned");
  return {
    activas: assigned.filter((routine) => routine.status === "activa").length,
    borradores: assigned.filter((routine) => routine.status === "borrador").length,
    archivadas: assigned.filter((routine) => routine.status === "archivada").length,
  } satisfies Record<RoutineStatusSection, number>;
}

export function routinesForStatusSection(routines: TrainingRoutine[], section: RoutineStatusSection) {
  const matching = routines.filter((routine) => routine.kind === "assigned" && routine.status === statusBySection[section]);
  if (section !== "borradores") return matching;
  return [...matching].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}
