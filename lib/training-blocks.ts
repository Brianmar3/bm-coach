import type { PortalWorkoutBlock, PortalWorkoutBlockResult } from "../types/portal.ts";
import type { TrainingExercise, TrainingRoutineBlock } from "../types/gestion.ts";

export const TRAINING_BLOCK_LABELS = { STRENGTH: "Fuerza", ROUNDS: "Circuito", INTERVAL: "Intervalos", EMOM: "EMOM", AMRAP: "AMRAP", FOR_TIME: "For time", FREE: "Bloque libre" } as const;

export function emptyBlockResult(): PortalWorkoutBlockResult {
  return { completed: false, roundsCompleted: null, minutesCompleted: null, extraRepetitions: null, durationSeconds: null, pendingWork: "", resultText: "", observation: "", completedExerciseIds: [] };
}

export function exerciseTargetLabel(exercise: Pick<TrainingExercise, "targetType" | "targetSeconds" | "targetRepetitions" | "targetDistance" | "targetSide" | "repetitions">) {
  const main = exercise.targetType === "TIME" ? `${exercise.targetSeconds ?? 0} segundos`
    : exercise.targetType === "REST" ? `Descanso · ${exercise.targetSeconds ?? 0} segundos`
      : exercise.targetType === "REPS" ? `${exercise.targetRepetitions || exercise.repetitions} repeticiones`
        : exercise.targetType === "DISTANCE" ? exercise.targetDistance || "Distancia libre"
          : "Tarea libre";
  return exercise.targetSide ? `${main} · ${exercise.targetSide}` : main;
}

export function blockConfiguration(block: TrainingRoutineBlock): Record<string, number | string | null> {
  return { rounds: block.rounds, durationSeconds: block.durationSeconds, workSeconds: block.workSeconds, restSeconds: block.restSeconds, restBetweenRoundsSeconds: block.restBetweenRoundsSeconds, targetRounds: block.targetRounds, instructions: block.instructions };
}

export function freshWorkoutBlock(block: TrainingRoutineBlock): PortalWorkoutBlock {
  return { blockId: block.id, blockName: block.name, blockType: block.type, blockOrder: block.order, configuration: blockConfiguration(block), exercises: block.exercises.map((exercise) => ({ exerciseId: exercise.id, name: exercise.name, targetType: exercise.targetType, targetLabel: exerciseTargetLabel(exercise), order: exercise.order })), result: emptyBlockResult() };
}

export function hasBlockActivity(block: PortalWorkoutBlock) {
  const result = block.result;
  return result.completed || Boolean(result.roundsCompleted || result.minutesCompleted || result.extraRepetitions || result.durationSeconds || result.pendingWork.trim() || result.resultText.trim() || result.observation.trim() || result.completedExerciseIds.length);
}

export function validateWorkoutBlock(block: PortalWorkoutBlock) {
  if (!block.blockId || !block.blockName.trim() || !Array.isArray(block.exercises) || !block.result || !Array.isArray(block.result.completedExerciseIds)) return "Los datos de un bloque no son válidos.";
  if (block.result.observation.length > 1000 || block.result.pendingWork.length > 500 || block.result.resultText.length > 2000) return "El resultado de un bloque es demasiado extenso.";
  for (const value of [block.result.roundsCompleted, block.result.minutesCompleted, block.result.extraRepetitions, block.result.durationSeconds]) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 86400)) return "El resultado numérico de un bloque no es válido.";
  }
  if (block.blockType === "AMRAP" && hasBlockActivity(block) && block.result.roundsCompleted === null) return "Ingresá las vueltas completas del AMRAP.";
  if (block.blockType === "EMOM" && hasBlockActivity(block) && block.result.minutesCompleted === null) return "Ingresá los minutos realizados del EMOM.";
  if (block.blockType === "FOR_TIME" && block.result.completed && block.result.durationSeconds === null) return "Ingresá el tiempo final del bloque For time.";
  if (block.blockType === "FREE" && block.result.completed && !block.result.resultText.trim()) return "Ingresá el resultado del bloque libre.";
  return null;
}
