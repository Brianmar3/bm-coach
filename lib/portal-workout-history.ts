import type { Prisma } from "@prisma/client";
import type { PortalWorkoutSession } from "@/types/portal";

export const portalWorkoutSessionInclude = {
  day: true,
  routine: true,
  blocks: true,
  exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" as const } } } },
};

type WorkoutRecord = Prisma.WorkoutSessionGetPayload<{ include: typeof portalWorkoutSessionInclude }>;

export function serializePortalWorkoutSessions(records: WorkoutRecord[]): PortalWorkoutSession[] {
  return records.map((workout) => ({
    id: workout.id,
    routineId: workout.routineId ?? "",
    routineName: workout.routineNameSnapshot ?? workout.exercises.find((log) => log.snapshotVersion !== null)?.routineName ?? workout.routine?.name ?? "Rutina eliminada",
    dayId: workout.dayId ?? "",
    dayNumber: workout.routineDayNumberSnapshot ?? workout.exercises.find((log) => log.snapshotVersion !== null)?.routineDayNumber ?? workout.day?.dayNumber ?? 0,
    dayName: workout.routineDayNameSnapshot?.trim() || workout.day?.name?.trim() || undefined,
    dayEstimatedMinutes: workout.routineDayEstimatedMinutesSnapshot ?? workout.day?.estimatedMinutes ?? null,
    date: workout.date.toISOString().slice(0, 10),
    startTime: workout.startTime,
    durationMinutes: workout.durationMinutes,
    energyBefore: workout.energyBefore,
    difficulty: workout.difficulty,
    energyAfter: workout.energyAfter,
    finalComment: workout.finalComment,
    hasPain: workout.hasPain,
    painDetails: workout.painDetails,
    status: workout.status === "COMPLETED" ? "finalizado" : workout.status === "IN_PROGRESS" ? "en_progreso" : "pendiente",
    blocks: [...workout.blocks].sort((left, right) => left.blockOrder - right.blockOrder).map((log) => ({
      id: log.id,
      blockId: log.blockReferenceId,
      blockName: log.blockName,
      blockType: log.blockType,
      blockOrder: log.blockOrder,
      configuration: log.blockConfiguration as Record<string, number | string | null>,
      exercises: log.exercisesSnapshot as Array<{ exerciseId: string; name: string; targetType: string; targetLabel: string; order: number }>,
      result: log.result as unknown as import("@/types/portal").PortalWorkoutBlockResult,
    })),
    exercises: [...workout.exercises].sort((left, right) => (left.exerciseOrder ?? left.exercise?.order ?? 0) - (right.exerciseOrder ?? right.exercise?.order ?? 0)).map((log) => {
      const older = records
        .filter((candidate) => candidate.id !== workout.id && candidate.date <= workout.date)
        .flatMap((candidate) => candidate.exercises.filter((item) => (item.exerciseReferenceId ?? item.exerciseId) === (log.exerciseReferenceId ?? log.exerciseId)).map((item) => ({ candidate, item })))
        .sort((left, right) => right.candidate.date.getTime() - left.candidate.date.getTime());
      const history = older.slice(0, 8).map(({ candidate, item }) => {
        const best = [...item.sets].filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? item.sets[0];
        return { date: candidate.date.toISOString().slice(0, 10), weight: best?.weight == null ? null : Number(best.weight), repetitions: best?.repetitions ?? null, effort: best?.effort == null ? null : Number(best.effort) };
      });
      return {
        id: log.id,
        exerciseId: log.exerciseReferenceId ?? log.exerciseId ?? log.id,
        exerciseName: log.snapshotVersion !== null ? log.exerciseName ?? "Ejercicio eliminado" : log.exercise?.name ?? "Ejercicio eliminado",
        observation: log.observation,
        sets: log.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, weight: set.weight == null ? null : Number(set.weight), repetitions: set.repetitions, effort: set.effort == null ? null : Number(set.effort), completed: set.completed, observation: set.observation })),
        previous: history[0] ?? null,
        history,
      };
    }),
  }));
}
