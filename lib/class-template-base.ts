import type { RoutineExerciseDraft } from "./routine-exercise-draft.ts";
import { librarySnapshotToEditableBlock, type EditableTrainingBlockDraft } from "./training-library-block-draft.ts";
import type { BlockInput, ExerciseInput } from "./rutinas.ts";
import type { TrainingRoutine, TrainingRoutineDay, TrainingRoutineKind, TrainingRoutineLevel, TrainingRoutineStatus } from "../types/gestion.ts";

export const CLASS_TYPE_TAG_PREFIX = "Tipo de clase:";

export type ClassBaseDayDraft = {
  id?: string;
  clientId: string;
  dayNumber: number;
  name: string;
  objective: string;
  warmup: string;
  observations: string;
  estimatedMinutes: number | null;
  blocks: EditableTrainingBlockDraft[];
  exercises: RoutineExerciseDraft[];
};

export type ClassBaseRoutineDraft = {
  name: string;
  kind: TrainingRoutineKind;
  description: string;
  objective: string;
  level: TrainingRoutineLevel;
  status: TrainingRoutineStatus;
  startDate: string;
  durationWeeks: number | null;
  priorityMuscles: string[];
  location: string;
  equipment: string[];
  tags: string[];
  studentIds: string[];
  days: ClassBaseDayDraft[];
};

export function isClassTypeTag(tag: string) {
  return tag.trim().toLocaleLowerCase("es").startsWith(CLASS_TYPE_TAG_PREFIX.toLocaleLowerCase("es"));
}

export function isReusableCompleteClass(source: TrainingRoutine) {
  return source.kind === "template" && source.days.length === 1;
}

function exerciseSnapshot(exercise: TrainingRoutineDay["exercises"][number]): ExerciseInput {
  return {
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: exercise.sets,
    repetitions: exercise.repetitions,
    weight: exercise.weight,
    effortType: exercise.effortType,
    effortValue: exercise.effortValue,
    restSeconds: exercise.restSeconds,
    observations: exercise.observations,
    videoUrl: exercise.videoUrl,
    tempo: exercise.tempo,
    alternativeExercise: exercise.alternativeExercise,
    equipment: exercise.equipment,
    optional: exercise.optional,
    targetType: exercise.targetType,
    targetSeconds: exercise.targetSeconds,
    targetRepetitions: exercise.targetRepetitions,
    targetDistance: exercise.targetDistance,
    targetSide: exercise.targetSide,
    order: exercise.order,
  };
}

function blockSnapshot(day: TrainingRoutineDay): BlockInput[] {
  if (day.blocks.length) {
    return [...day.blocks].sort((a, b) => a.order - b.order).map((block) => ({
      type: block.type,
      name: block.name,
      order: block.order,
      rounds: block.rounds,
      durationSeconds: block.durationSeconds,
      workSeconds: block.workSeconds,
      restSeconds: block.restSeconds,
      restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
      targetRounds: block.targetRounds,
      instructions: block.instructions,
      exercises: [...block.exercises].sort((a, b) => a.order - b.order).map(exerciseSnapshot),
    }));
  }
  return [{
    type: "STRENGTH",
    name: "Bloque de fuerza",
    order: 1,
    rounds: null,
    durationSeconds: null,
    workSeconds: null,
    restSeconds: null,
    restBetweenRoundsSeconds: null,
    targetRounds: null,
    instructions: "",
    exercises: [...day.exercises].sort((a, b) => a.order - b.order).map(exerciseSnapshot),
  }];
}

function clonedDay(source: TrainingRoutine, name: string, createId: () => string): ClassBaseDayDraft {
  const day = source.days[0];
  if (!day) throw new Error("La clase completa no tiene una jornada reutilizable.");
  return {
    clientId: createId(),
    dayNumber: 1,
    name,
    objective: day.objective,
    warmup: day.warmup,
    observations: day.observations,
    estimatedMinutes: day.estimatedMinutes,
    blocks: blockSnapshot(day).map((block, index) => librarySnapshotToEditableBlock(block, index + 1, createId)),
    exercises: [],
  };
}

function assertReusable(source: TrainingRoutine) {
  if (!isReusableCompleteClass(source)) throw new Error("Sólo las clases completas de una jornada pueden reutilizarse con este flujo.");
}

export function classTemplateToClassDraft(
  source: TrainingRoutine,
  createId: () => string = () => crypto.randomUUID(),
): ClassBaseRoutineDraft {
  assertReusable(source);
  const name = `Copia de ${source.name}`;
  return {
    name,
    kind: "template",
    description: source.description,
    objective: source.objective,
    level: source.level,
    status: "borrador",
    startDate: "",
    durationWeeks: null,
    priorityMuscles: [],
    location: source.location,
    equipment: [...source.equipment],
    tags: [...source.tags],
    studentIds: [],
    days: [clonedDay(source, name, createId)],
  };
}

export function classTemplateToRoutineDraft(
  source: TrainingRoutine,
  createId: () => string = () => crypto.randomUUID(),
): ClassBaseRoutineDraft {
  assertReusable(source);
  return {
    name: source.name,
    kind: "assigned",
    description: source.description,
    objective: source.objective,
    level: source.level,
    status: "borrador",
    startDate: "",
    durationWeeks: null,
    priorityMuscles: [],
    location: source.location,
    equipment: [...source.equipment],
    tags: source.tags.filter((tag) => !isClassTypeTag(tag)),
    studentIds: [],
    days: [clonedDay(source, "Día 1", createId)],
  };
}
