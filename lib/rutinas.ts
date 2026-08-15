import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { Student, TrainingBlockType, TrainingEffortType, TrainingExercise, TrainingExerciseTargetType, TrainingRoutine, TrainingRoutineBlock, TrainingRoutineKind, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";
import { isValidRoutineVideoUrl } from "./routine-exercise-media.ts";

export type ExerciseInput = Omit<TrainingExercise, "id" | "blockId"> & { id?: string; blockId?: string };
export type BlockInput = Omit<TrainingRoutineBlock, "id" | "exercises"> & { id?: string; exercises: ExerciseInput[] };
export type RoutineDayInput = {
  id?: string;
  dayNumber: number;
  name: string;
  objective: string;
  warmup?: string;
  observations: string;
  estimatedMinutes: number | null;
  exercises: ExerciseInput[];
  blocks?: BlockInput[];
};
export type RoutineInput = {
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
  days: RoutineDayInput[];
};

export const routineInclude = {
  days: { where: { active: true }, include: {
    blocks: { where: { active: true }, include: { exercises: { where: { active: true }, orderBy: { order: "asc" as const } } }, orderBy: { order: "asc" as const } },
    exercises: { where: { active: true }, orderBy: { order: "asc" as const } },
  }, orderBy: { dayNumber: "asc" as const } },
  assignments: { include: { student: true } },
};

export type RoutineWithRelations = Prisma.TrainingRoutineGetPayload<{ include: typeof routineInclude }>;

const levels: TrainingRoutineLevel[] = ["principiante", "intermedio", "avanzado"];
const statuses: TrainingRoutineStatus[] = ["borrador", "activa", "finalizada", "archivada"];
const effortTypes: TrainingEffortType[] = ["RPE", "RIR"];
const kinds: TrainingRoutineKind[] = ["assigned", "template"];
const blockTypes: TrainingBlockType[] = ["STRENGTH", "ROUNDS", "INTERVAL", "EMOM", "AMRAP", "FOR_TIME", "FREE"];
const targetTypes: TrainingExerciseTargetType[] = ["TIME", "REPS", "DISTANCE", "REST", "FREE"];

const levelToDatabase = { principiante: "PRINCIPIANTE", intermedio: "INTERMEDIO", avanzado: "AVANZADO" } as const;
const statusToDatabase = { borrador: "BORRADOR", activa: "ACTIVA", finalizada: "FINALIZADA", archivada: "ARCHIVADA" } as const;
const levelFromDatabase = { PRINCIPIANTE: "principiante", INTERMEDIO: "intermedio", AVANZADO: "avanzado" } as const;
const statusFromDatabase = { BORRADOR: "borrador", ACTIVA: "activa", FINALIZADA: "finalizada", ARCHIVADA: "archivada" } as const;
const kindToDatabase = { assigned: "ASSIGNED", template: "TEMPLATE" } as const;
const kindFromDatabase = { ASSIGNED: "assigned", TEMPLATE: "template" } as const;

export type RoutineValidationIssue = { key: string; message: string; summary: string; dayNumber?: number };

type FieldIssue = { field: string; message: string };

function exerciseValidationIssues(input: ExerciseInput, blockType: TrainingBlockType): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!input.name?.trim()) issues.push({ field: "name", message: "Ingresá el nombre del ejercicio." });
  if (blockType !== "INTERVAL" && !input.muscleGroup?.trim()) issues.push({ field: "muscleGroup", message: "Ingresá el grupo muscular." });
  if (!Number.isInteger(input.order) || input.order < 1 || input.order > 999) issues.push({ field: "order", message: "El orden debe ser un entero entre 1 y 999." });
  if ((input.observations?.length ?? 0) > 1000) issues.push({ field: "observations", message: "Las observaciones del ejercicio son demasiado extensas." });
  if ((input.alternativeExercise?.length ?? 0) > 120) issues.push({ field: "alternativeExercise", message: "El ejercicio alternativo es demasiado extenso." });
  if (!isValidRoutineVideoUrl(input.videoUrl)) issues.push({ field: "videoUrl", message: "El video debe ser una URL http/https o una referencia válida de Biblioteca BM." });
  if (blockType !== "STRENGTH") {
    if (!targetTypes.includes(input.targetType)) issues.push({ field: "targetType", message: "Seleccioná un objetivo válido para cada ejercicio." });
    if ((input.targetSide?.length ?? 0) > 80) issues.push({ field: "targetSide", message: "La indicación del ejercicio es demasiado extensa." });
    if (input.targetType === "TIME") {
      if (input.targetSeconds === null && blockType !== "INTERVAL") issues.push({ field: "targetSeconds", message: "Ingresá los segundos objetivo." });
      if (input.targetSeconds !== null && (!Number.isInteger(input.targetSeconds) || input.targetSeconds < 1 || input.targetSeconds > 86400)) issues.push({ field: "targetSeconds", message: "El tiempo objetivo no es válido." });
    }
    if (input.targetType === "REST" && (input.targetSeconds === null || !Number.isInteger(input.targetSeconds) || input.targetSeconds < 1 || input.targetSeconds > 86400)) issues.push({ field: "targetSeconds", message: "Ingresá segundos de descanso válidos." });
    if (input.targetType === "REPS") {
      const repetitions = input.targetRepetitions?.match(/\d+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(",", "."))) ?? [];
      if (!input.targetRepetitions?.trim() || input.targetRepetitions.length > 50 || !repetitions.length || repetitions.some((value) => value <= 0)) issues.push({ field: "targetRepetitions", message: "Ingresá repeticiones objetivo mayores a 0." });
    }
    if (input.targetType === "DISTANCE" && (!input.targetDistance?.trim() || input.targetDistance.length > 50)) issues.push({ field: "targetDistance", message: "Ingresá la distancia objetivo." });
    return issues;
  }
  if (!Number.isInteger(input.sets) || input.sets < 1 || input.sets > 100) issues.push({ field: "sets", message: "Las series deben ser un número entero entre 1 y 100." });
  if (!input.repetitions?.trim() || input.repetitions.length > 50) issues.push({ field: "repetitions", message: "Ingresá repeticiones válidas." });
  if (input.weight !== null && (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 1000)) issues.push({ field: "weight", message: "El peso debe estar entre 0 y 1000 kg." });
  if (!effortTypes.includes(input.effortType)) issues.push({ field: "effortType", message: "Seleccioná RPE o RIR." });
  if (input.effortValue !== null && (!Number.isFinite(input.effortValue) || input.effortValue < 0 || input.effortValue > 10)) issues.push({ field: "effortValue", message: "El valor de RPE/RIR debe estar entre 0 y 10." });
  if (input.restSeconds !== null && (!Number.isInteger(input.restSeconds) || input.restSeconds < 0 || input.restSeconds > 3600)) issues.push({ field: "restSeconds", message: "El descanso debe estar entre 0 y 3600 segundos." });
  if ((input.tempo?.length ?? 0) > 40 || (input.equipment?.length ?? 0) > 120) issues.push({ field: (input.tempo?.length ?? 0) > 40 ? "tempo" : "equipment", message: "Los datos complementarios del ejercicio son demasiado extensos." });
  return issues;
}

export function validateExercise(input: ExerciseInput, blockType: TrainingBlockType = "STRENGTH") {
  return exerciseValidationIssues(input, blockType)[0]?.message ?? null;
}

export function normalizedBlocks(day: RoutineDayInput): BlockInput[] {
  if (Array.isArray(day.blocks) && day.blocks.length) return [...day.blocks].sort((a, b) => a.order - b.order);
  return [{ type: "STRENGTH", name: "Bloque de fuerza", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: day.exercises ?? [] }];
}

function blockValidationIssues(block: BlockInput): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!blockTypes.includes(block.type)) issues.push({ field: "type", message: "Seleccioná un tipo de bloque válido." });
  if (!block.name?.trim() || block.name.trim().length > 120) issues.push({ field: "name", message: "Cada bloque necesita un nombre de hasta 120 caracteres." });
  if (!Number.isInteger(block.order) || block.order < 1 || block.order > 99) issues.push({ field: "order", message: "El orden del bloque no es válido." });
  if ((block.instructions?.length ?? 0) > 2000) issues.push({ field: "instructions", message: "Las instrucciones del bloque son demasiado extensas." });
  const numericFields = ["rounds", "durationSeconds", "workSeconds", "restSeconds", "restBetweenRoundsSeconds", "targetRounds"] as const;
  for (const field of numericFields) {
    const value = block[field];
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 86400)) issues.push({ field, message: "La configuración numérica del bloque no es válida." });
  }
  if (["ROUNDS", "INTERVAL", "FOR_TIME"].includes(block.type) && !block.rounds) issues.push({ field: "rounds", message: "Ingresá la cantidad de rondas del bloque." });
  if (["EMOM", "AMRAP"].includes(block.type) && !block.durationSeconds) issues.push({ field: "durationSeconds", message: "Ingresá la duración total del bloque." });
  if (block.type === "INTERVAL" && !block.workSeconds) issues.push({ field: "workSeconds", message: "Ingresá los segundos de trabajo." });
  if (block.type === "INTERVAL" && block.restSeconds === null) issues.push({ field: "restSeconds", message: "Ingresá los segundos de descanso." });
  if (!Array.isArray(block.exercises)) issues.push({ field: "exercises", message: "Los ejercicios del bloque no son válidos." });
  return issues;
}

export function validateBlock(block: BlockInput) {
  const blockIssue = blockValidationIssues(block)[0];
  if (blockIssue) return blockIssue.message;
  for (const exercise of block.exercises) {
    const issue = exerciseValidationIssues(exercise, block.type)[0];
    if (issue) return issue.message;
  }
  return null;
}

export function routineValidationIssues(input: RoutineInput): RoutineValidationIssue[] {
  const issues: RoutineValidationIssue[] = [];
  const add = (key: string, message: string, dayNumber?: number, context?: string) => issues.push({ key, message, dayNumber, summary: context ? `${context}: ${message}` : message });
  if (!kinds.includes(input.kind)) add("routine.kind", "Seleccioná un tipo de rutina válido.");
  if (!input.name?.trim() || input.name.trim().length > 120) add("routine.name", "Ingresá un nombre de rutina de hasta 120 caracteres.");
  if (!input.objective?.trim() || input.objective.trim().length > 100) add("routine.objective", "Seleccioná un objetivo válido.");
  if (!levels.includes(input.level)) add("routine.level", "Seleccioná un nivel válido.");
  if (!statuses.includes(input.status)) add("routine.status", "Seleccioná un estado válido.");
  if (input.kind === "template" && input.status === "finalizada") add("routine.status", "Una plantilla no puede marcarse como finalizada.");
  if ((input.description?.length ?? 0) > 1000) add("routine.description", "La descripción es demasiado extensa.");
  if ((input.location?.length ?? 0) > 100) add("routine.location", "El lugar es demasiado extenso.");
  if (input.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) add("routine.startDate", "La fecha de inicio no es válida.");
  if (input.durationWeeks !== null && (!Number.isInteger(input.durationWeeks) || input.durationWeeks < 1 || input.durationWeeks > 104)) add("routine.durationWeeks", "La duración debe estar entre 1 y 104 semanas.");
  if (!Array.isArray(input.priorityMuscles) || input.priorityMuscles.length > 30 || input.priorityMuscles.some((muscle) => !muscle.trim() || muscle.length > 80)) add("routine.priorityMuscles", "Los músculos prioritarios no son válidos.");
  if (!Array.isArray(input.studentIds) || new Set(input.studentIds).size !== input.studentIds.length || input.studentIds.some((id) => !id?.trim())) add("routine.studentIds", "La asignación de alumnos no es válida.");
  if (input.kind === "template" && input.studentIds.length) add("routine.studentIds", "Las plantillas no pueden tener alumnos asignados.");
  for (const [field, values] of [["equipment", input.equipment], ["tags", input.tags]] as const) {
    if (!Array.isArray(values) || values.length > 30 || values.some((value) => !value.trim() || value.length > 80)) add(`routine.${field}`, field === "equipment" ? "El equipamiento no es válido." : "Las etiquetas no son válidas.");
  }
  if (!Array.isArray(input.days) || input.days.length < 1 || input.days.length > 14) {
    add("routine.days", "La rutina debe incluir entre 1 y 14 días.");
    return issues;
  }
  const dayNumbers = input.days.map((day) => day.dayNumber);
  if (new Set(dayNumbers).size !== input.days.length || [...dayNumbers].sort((a, b) => a - b).some((day, index) => day !== index + 1)) add("routine.days", "Los días deben tener un orden consecutivo.");
  for (const day of input.days) {
    const dayPrefix = `day.${day.dayNumber}`;
    const dayContext = `Día ${day.dayNumber}`;
    if (!day.name?.trim() || day.name.trim().length > 100) add(`${dayPrefix}.name`, "Ingresá un nombre válido.", day.dayNumber, dayContext);
    if ((day.objective?.length ?? 0) > 200) add(`${dayPrefix}.objective`, "El objetivo es demasiado extenso.", day.dayNumber, dayContext);
    if ((day.warmup?.length ?? 0) > 2000) add(`${dayPrefix}.warmup`, "La entrada en calor es demasiado extensa.", day.dayNumber, dayContext);
    if ((day.observations?.length ?? 0) > 1000) add(`${dayPrefix}.observations`, "Las observaciones son demasiado extensas.", day.dayNumber, dayContext);
    if (day.estimatedMinutes !== null && (!Number.isInteger(day.estimatedMinutes) || day.estimatedMinutes < 1 || day.estimatedMinutes > 1440)) add(`${dayPrefix}.estimatedMinutes`, "La duración estimada no es válida.", day.dayNumber, dayContext);
    if (!Array.isArray(day.exercises) && !Array.isArray(day.blocks)) { add(`${dayPrefix}.exercises`, "Los ejercicios no son válidos.", day.dayNumber, dayContext); continue; }
    const blocks = normalizedBlocks(day);
    if (blocks.length > 20) add(`${dayPrefix}.blocks`, "El día tiene demasiados bloques.", day.dayNumber, dayContext);
    if (new Set(blocks.map((block) => block.order)).size !== blocks.length) add(`${dayPrefix}.blocks`, "Los bloques tienen órdenes repetidos.", day.dayNumber, dayContext);
    for (const block of blocks) {
      const blockPrefix = `${dayPrefix}.block.${block.order}`;
      const blockContext = `${dayContext}, ${block.name || "bloque"}`;
      for (const issue of blockValidationIssues(block)) add(`${blockPrefix}.${issue.field}`, issue.message, day.dayNumber, blockContext);
      if (!Array.isArray(block.exercises)) continue;
      for (const exercise of block.exercises) {
        for (const issue of exerciseValidationIssues(exercise, block.type)) add(`${blockPrefix}.exercise.${exercise.order}.${issue.field}`, issue.message, day.dayNumber, `${blockContext}, ejercicio ${exercise.order}`);
      }
    }
  }
  return issues;
}

export function validateRoutine(input: RoutineInput) {
  return routineValidationIssues(input)[0]?.summary ?? null;
}

export function exerciseData(input: ExerciseInput) {
  return {
    name: input.name.trim(),
    muscleGroup: input.muscleGroup.trim(),
    sets: input.sets,
    repetitions: input.repetitions.trim(),
    weight: input.weight,
    effortType: input.effortType,
    effortValue: input.effortValue,
    restSeconds: input.restSeconds,
    observations: input.observations?.trim() ?? "",
    videoUrl: input.videoUrl?.trim() || null,
    tempo: input.tempo?.trim() || null,
    alternativeExercise: input.alternativeExercise?.trim() || null,
    equipment: input.equipment?.trim() || null,
    optional: Boolean(input.optional),
    targetType: input.targetType,
    targetSeconds: input.targetSeconds,
    targetRepetitions: input.targetRepetitions?.trim() || null,
    targetDistance: input.targetDistance?.trim() || null,
    targetSide: input.targetSide?.trim() || null,
    order: input.order,
  };
}

export function blockData(input: BlockInput) {
  return {
    type: input.type,
    name: input.name.trim(),
    order: input.order,
    rounds: input.rounds,
    durationSeconds: input.durationSeconds,
    workSeconds: input.workSeconds,
    restSeconds: input.restSeconds,
    restBetweenRoundsSeconds: input.restBetweenRoundsSeconds,
    targetRounds: input.targetRounds,
    instructions: input.instructions.trim(),
  };
}

export function routineData(input: RoutineInput) {
  return {
    name: input.name.trim(),
    kind: kindToDatabase[input.kind],
    description: input.description.trim(),
    objective: input.objective.trim(),
    level: levelToDatabase[input.level],
    status: statusToDatabase[input.status],
    startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null,
    durationWeeks: input.durationWeeks,
    priorityMuscles: input.priorityMuscles.map((muscle) => muscle.trim()),
    location: input.location.trim(),
    equipment: input.equipment.map((value) => value.trim()),
    tags: input.tags.map((value) => value.trim()),
    archivedAt: input.status === "archivada" ? new Date() : null,
  };
}

export function nestedDays(days: RoutineDayInput[]) {
  return days.sort((a, b) => a.dayNumber - b.dayNumber).map((day) => ({
    dayNumber: day.dayNumber,
    name: day.name.trim(),
    objective: day.objective?.trim() ?? "",
    warmup: day.warmup?.trim() ?? "",
    observations: day.observations?.trim() ?? "",
    estimatedMinutes: day.estimatedMinutes,
  }));
}

export async function createRoutineDays(transaction: Prisma.TransactionClient, routineId: string, days: RoutineDayInput[]) {
  for (const dayInput of nestedDays(days)) {
    const day = await transaction.trainingRoutineDay.create({ data: { routineId, ...dayInput } });
    for (const blockInput of normalizedBlocks(days.find((item) => item.dayNumber === dayInput.dayNumber)!)) {
      const block = await transaction.trainingRoutineBlock.create({ data: { routineDayId: day.id, ...blockData(blockInput) } });
      if (blockInput.exercises.length) {
        await transaction.trainingRoutineExercise.createMany({ data: blockInput.exercises.map((exercise) => ({ dayId: day.id, blockId: block.id, ...exerciseData(exercise) })) });
      }
    }
  }
}

export function routineVersionSnapshot(input: RoutineInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    description: input.description.trim(),
    objective: input.objective.trim(),
    level: input.level,
    status: input.status,
    startDate: input.startDate,
    durationWeeks: input.durationWeeks,
    priorityMuscles: [...input.priorityMuscles].map((muscle) => muscle.trim()).sort((left, right) => left.localeCompare(right, "es")),
    location: input.location.trim(),
    equipment: [...input.equipment].map((value) => value.trim()).sort(),
    tags: [...input.tags].map((value) => value.trim()).sort(),
    studentIds: [...input.studentIds].sort(),
    days: [...input.days].sort((left, right) => left.dayNumber - right.dayNumber).map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      name: day.name.trim(),
      objective: day.objective?.trim() ?? "",
      warmup: day.warmup?.trim() ?? "",
      observations: day.observations?.trim() ?? "",
      estimatedMinutes: day.estimatedMinutes,
      blocks: normalizedBlocks(day).map((block) => ({
        ...block,
        exercises: [...block.exercises].sort((left, right) => left.order - right.order).map((exercise) => ({
          ...exercise,
          observations: exercise.observations?.trim() ?? "",
          videoUrl: exercise.videoUrl?.trim() ?? "",
          tempo: exercise.tempo?.trim() ?? "",
          alternativeExercise: exercise.alternativeExercise?.trim() ?? "",
          equipment: exercise.equipment?.trim() ?? "",
        })),
      })),
      exercises: normalizedBlocks(day).flatMap((block) => block.exercises).map((exercise) => ({
        ...exercise,
        observations: exercise.observations?.trim() ?? "",
        videoUrl: exercise.videoUrl?.trim() ?? "",
        tempo: exercise.tempo?.trim() ?? "",
        alternativeExercise: exercise.alternativeExercise?.trim() ?? "",
        equipment: exercise.equipment?.trim() ?? "",
      })),
    })),
  } satisfies RoutineInput;
}

export function routineFingerprint(input: RoutineInput) {
  return createHash("sha256").update(JSON.stringify(routineVersionSnapshot(input))).digest("hex");
}

export function serializeExercise(record: RoutineWithRelations["days"][number]["exercises"][number]): TrainingExercise {
  return {
    id: record.id,
    name: record.name,
    muscleGroup: record.muscleGroup,
    sets: record.sets,
    repetitions: record.repetitions,
    weight: record.weight === null ? null : Number(record.weight),
    effortType: record.effortType,
    effortValue: record.effortValue === null ? null : Number(record.effortValue),
    restSeconds: record.restSeconds,
    observations: record.observations,
    videoUrl: record.videoUrl ?? "",
    tempo: record.tempo ?? "",
    alternativeExercise: record.alternativeExercise ?? "",
    equipment: record.equipment ?? "",
    optional: record.optional,
    blockId: record.blockId,
    targetType: record.targetType,
    targetSeconds: record.targetSeconds,
    targetRepetitions: record.targetRepetitions ?? "",
    targetDistance: record.targetDistance ?? "",
    targetSide: record.targetSide ?? "",
    order: record.order,
  };
}

function serializeBlock(record: RoutineWithRelations["days"][number]["blocks"][number]): TrainingRoutineBlock {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    order: record.order,
    rounds: record.rounds,
    durationSeconds: record.durationSeconds,
    workSeconds: record.workSeconds,
    restSeconds: record.restSeconds,
    restBetweenRoundsSeconds: record.restBetweenRoundsSeconds,
    targetRounds: record.targetRounds,
    instructions: record.instructions,
    exercises: record.exercises.map(serializeExercise),
  };
}

export function serializeRoutine(record: RoutineWithRelations): TrainingRoutine {
  const assignmentStudents = record.assignments.map((assignment) => {
    const student = assignment.student.data as unknown as Student;
    return { id: assignment.studentId, name: `${student.firstName} ${student.lastName}`.trim(), active: assignment.active };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const students = assignmentStudents.filter((student) => student.active).map(({ id, name }) => ({ id, name }));
  return {
    id: record.id,
    name: record.name,
    kind: kindFromDatabase[record.kind],
    description: record.description,
    objective: record.objective,
    level: levelFromDatabase[record.level],
    status: statusFromDatabase[record.status],
    startDate: record.startDate?.toISOString().slice(0, 10) ?? "",
    durationWeeks: record.durationWeeks,
    priorityMuscles: record.priorityMuscles,
    location: record.location,
    equipment: record.equipment,
    tags: record.tags,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    archivedAt: record.archivedAt?.toISOString() ?? "",
    studentIds: students.map((student) => student.id),
    students,
    historicalStudents: assignmentStudents.map(({ id, name }) => ({ id, name })),
    days: record.days.map((day) => {
      const blocks = day.blocks.map(serializeBlock);
      return {
      id: day.id,
      dayNumber: day.dayNumber,
      name: day.name.trim() || `Día ${day.dayNumber}`,
      objective: day.objective,
      warmup: day.warmup,
      observations: day.observations,
      estimatedMinutes: day.estimatedMinutes,
      blocks,
      exercises: blocks.flatMap((block) => block.exercises),
    };
    }),
  };
}

export function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}
