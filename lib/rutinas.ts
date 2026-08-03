import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { Student, TrainingBlockType, TrainingEffortType, TrainingExercise, TrainingExerciseTargetType, TrainingRoutine, TrainingRoutineBlock, TrainingRoutineKind, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";

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

function validUrl(value: string | undefined) {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateExercise(input: ExerciseInput, blockType: TrainingBlockType = "STRENGTH") {
  if (!input.name?.trim() || !input.muscleGroup?.trim()) return "Cada ejercicio necesita nombre y grupo muscular.";
  if (!Number.isInteger(input.order) || input.order < 1 || input.order > 999) return "El orden debe ser un entero entre 1 y 999.";
  if ((input.observations?.length ?? 0) > 1000) return "Las observaciones del ejercicio son demasiado extensas.";
  if ((input.alternativeExercise?.length ?? 0) > 120) return "El ejercicio alternativo es demasiado extenso.";
  if (!validUrl(input.videoUrl)) return "La URL del video debe comenzar con http o https.";
  if (blockType !== "STRENGTH") {
    if (!targetTypes.includes(input.targetType)) return "Seleccioná un objetivo válido para cada ejercicio.";
    if ((input.targetSide?.length ?? 0) > 80) return "La indicación del ejercicio es demasiado extensa.";
    if (input.targetType === "TIME") {
      if (input.targetSeconds === null && blockType !== "INTERVAL") return "Ingresá los segundos objetivo.";
      if (input.targetSeconds !== null && (!Number.isInteger(input.targetSeconds) || input.targetSeconds < 1 || input.targetSeconds > 86400)) return "El tiempo objetivo no es válido.";
    }
    if (input.targetType === "REST" && (input.targetSeconds === null || !Number.isInteger(input.targetSeconds) || input.targetSeconds < 1 || input.targetSeconds > 86400)) return "Ingresá segundos de descanso válidos.";
    if (input.targetType === "REPS") {
      const repetitions = input.targetRepetitions?.match(/\d+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(",", "."))) ?? [];
      if (!input.targetRepetitions?.trim() || input.targetRepetitions.length > 50 || !repetitions.length || repetitions.some((value) => value <= 0)) return "Ingresá repeticiones objetivo mayores a 0.";
    }
    if (input.targetType === "DISTANCE" && (!input.targetDistance?.trim() || input.targetDistance.length > 50)) return "Ingresá la distancia objetivo.";
    return null;
  }
  if (!Number.isInteger(input.sets) || input.sets < 1 || input.sets > 100) return "Las series deben ser un número entero entre 1 y 100.";
  if (!input.repetitions?.trim() || input.repetitions.length > 50) return "Ingresá repeticiones válidas.";
  if (input.weight !== null && (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 1000)) return "El peso debe estar entre 0 y 1000 kg.";
  if (!effortTypes.includes(input.effortType)) return "Seleccioná RPE o RIR.";
  if (input.effortValue !== null && (!Number.isFinite(input.effortValue) || input.effortValue < 0 || input.effortValue > 10)) return "El valor de RPE/RIR debe estar entre 0 y 10.";
  if (input.restSeconds !== null && (!Number.isInteger(input.restSeconds) || input.restSeconds < 0 || input.restSeconds > 3600)) return "El descanso debe estar entre 0 y 3600 segundos.";
  if ((input.tempo?.length ?? 0) > 40 || (input.alternativeExercise?.length ?? 0) > 120 || (input.equipment?.length ?? 0) > 120) return "Los datos complementarios del ejercicio son demasiado extensos.";
  return null;
}

export function normalizedBlocks(day: RoutineDayInput): BlockInput[] {
  if (Array.isArray(day.blocks) && day.blocks.length) return [...day.blocks].sort((a, b) => a.order - b.order);
  return [{ type: "STRENGTH", name: "Bloque de fuerza", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: day.exercises ?? [] }];
}

export function validateBlock(block: BlockInput) {
  if (!blockTypes.includes(block.type)) return "Seleccioná un tipo de bloque válido.";
  if (!block.name?.trim() || block.name.trim().length > 120) return "Cada bloque necesita un nombre de hasta 120 caracteres.";
  if (!Number.isInteger(block.order) || block.order < 1 || block.order > 99) return "El orden del bloque no es válido.";
  if ((block.instructions?.length ?? 0) > 2000) return "Las instrucciones del bloque son demasiado extensas.";
  for (const value of [block.rounds, block.durationSeconds, block.workSeconds, block.restSeconds, block.restBetweenRoundsSeconds, block.targetRounds]) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 86400)) return "La configuración numérica del bloque no es válida.";
  }
  if (["ROUNDS", "INTERVAL", "FOR_TIME"].includes(block.type) && !block.rounds) return "Ingresá la cantidad de rondas del bloque.";
  if (["EMOM", "AMRAP"].includes(block.type) && !block.durationSeconds) return "Ingresá la duración total del bloque.";
  if (block.type === "INTERVAL" && (!block.workSeconds || block.restSeconds === null)) return "Ingresá los tiempos de trabajo y descanso.";
  if (!Array.isArray(block.exercises)) return "Los ejercicios del bloque no son válidos.";
  for (const exercise of block.exercises) {
    const error = validateExercise(exercise, block.type);
    if (error) return error;
  }
  return null;
}

export function validateRoutine(input: RoutineInput) {
  if (!kinds.includes(input.kind)) return "Seleccioná un tipo de rutina válido.";
  if ((input.description?.length ?? 0) > 1000 || (input.location?.length ?? 0) > 100) return "La descripción o el lugar son demasiado extensos.";
  if (input.kind === "template" && input.status === "finalizada") return "Una plantilla no puede marcarse como finalizada.";
  if (!input.name?.trim() || input.name.trim().length > 120) return "Ingresá un nombre de rutina de hasta 120 caracteres.";
  if (!input.objective?.trim() || input.objective.trim().length > 100) return "Seleccioná un objetivo válido.";
  if (!levels.includes(input.level)) return "Seleccioná un nivel válido.";
  if (!statuses.includes(input.status)) return "Seleccioná un estado válido.";
  if (input.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return "La fecha de inicio no es válida.";
  if (input.durationWeeks !== null && (!Number.isInteger(input.durationWeeks) || input.durationWeeks < 1 || input.durationWeeks > 104)) {
    return "La duración debe estar entre 1 y 104 semanas.";
  }
  if (!Array.isArray(input.priorityMuscles) || input.priorityMuscles.length > 30 || input.priorityMuscles.some((muscle) => !muscle.trim() || muscle.length > 80)) {
    return "Los músculos prioritarios no son válidos.";
  }
  if (!Array.isArray(input.studentIds)) return "La asignación de alumnos no es válida.";
  if (![input.equipment, input.tags].every((values) => Array.isArray(values) && values.length <= 30 && values.every((value) => value.trim() && value.length <= 80))) return "El equipamiento o las etiquetas no son válidos.";
  if (input.kind === "template" && input.studentIds.length) return "Las plantillas no pueden tener alumnos asignados.";
  if (new Set(input.studentIds).size !== input.studentIds.length || input.studentIds.some((id) => !id?.trim())) return "La asignación de alumnos no es válida.";
  if (!Array.isArray(input.days) || input.days.length < 1 || input.days.length > 14) return "La rutina debe incluir entre 1 y 14 días.";
  const dayNumbers = input.days.map((day) => day.dayNumber);
  if (new Set(dayNumbers).size !== input.days.length || [...dayNumbers].sort((a, b) => a - b).some((day, index) => day !== index + 1)) {
    return "Los días deben tener un orden consecutivo.";
  }
  for (const day of input.days) {
    if ((day.objective?.length ?? 0) > 200 || (day.warmup?.length ?? 0) > 2000 || (day.observations?.length ?? 0) > 1000) return `Los datos del día ${day.dayNumber} son demasiado extensos.`;
    if (!day.name?.trim() || day.name.trim().length > 100) return `Ingresá un nombre válido para el día ${day.dayNumber}.`;
    if (day.estimatedMinutes !== null && (!Number.isInteger(day.estimatedMinutes) || day.estimatedMinutes < 1 || day.estimatedMinutes > 1440)) {
      return `La duración estimada del día ${day.dayNumber} no es válida.`;
    }
    if (!Array.isArray(day.exercises) && !Array.isArray(day.blocks)) return `Los ejercicios del día ${day.dayNumber} no son válidos.`;
    const blocks = normalizedBlocks(day);
    if (blocks.length > 20) return `El día ${day.dayNumber} tiene demasiados bloques.`;
    if (new Set(blocks.map((block) => block.order)).size !== blocks.length) return `Los bloques del día ${day.dayNumber} tienen órdenes repetidos.`;
    for (const block of blocks) {
      const error = validateBlock(block);
      if (error) return `Día ${day.dayNumber}, ${block.name || "bloque"}: ${error}`;
    }
  }
  return null;
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
