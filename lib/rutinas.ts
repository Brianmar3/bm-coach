import { Prisma } from "@prisma/client";
import type { Student, TrainingEffortType, TrainingExercise, TrainingRoutine, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";

export type ExerciseInput = Omit<TrainingExercise, "id"> & { id?: string };
export type RoutineDayInput = { id?: string; dayNumber: number; exercises: ExerciseInput[] };
export type RoutineInput = {
  name: string;
  objective: string;
  level: TrainingRoutineLevel;
  status: TrainingRoutineStatus;
  studentIds: string[];
  days: RoutineDayInput[];
};

export const routineInclude = {
  days: { where: { active: true }, include: { exercises: { where: { active: true }, orderBy: { order: "asc" as const } } }, orderBy: { dayNumber: "asc" as const } },
  assignments: { include: { student: true } },
};

export type RoutineWithRelations = Prisma.TrainingRoutineGetPayload<{ include: typeof routineInclude }>;

const levels: TrainingRoutineLevel[] = ["principiante", "intermedio", "avanzado"];
const statuses: TrainingRoutineStatus[] = ["activa", "archivada"];
const effortTypes: TrainingEffortType[] = ["RPE", "RIR"];

const levelToDatabase = { principiante: "PRINCIPIANTE", intermedio: "INTERMEDIO", avanzado: "AVANZADO" } as const;
const statusToDatabase = { activa: "ACTIVA", archivada: "ARCHIVADA" } as const;
const levelFromDatabase = { PRINCIPIANTE: "principiante", INTERMEDIO: "intermedio", AVANZADO: "avanzado" } as const;
const statusFromDatabase = { ACTIVA: "activa", ARCHIVADA: "archivada" } as const;

function validUrl(value: string | undefined) {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateExercise(input: ExerciseInput) {
  if (!input.name?.trim() || !input.muscleGroup?.trim()) return "Cada ejercicio necesita nombre y grupo muscular.";
  if (!Number.isInteger(input.sets) || input.sets < 1 || input.sets > 100) return "Las series deben ser un número entero entre 1 y 100.";
  if (!input.repetitions?.trim() || input.repetitions.length > 50) return "Ingresá repeticiones válidas.";
  if (input.weight !== null && (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 1000)) return "El peso debe estar entre 0 y 1000 kg.";
  if (!effortTypes.includes(input.effortType)) return "Seleccioná RPE o RIR.";
  if (input.effortValue !== null && (!Number.isFinite(input.effortValue) || input.effortValue < 0 || input.effortValue > 10)) return "El valor de RPE/RIR debe estar entre 0 y 10.";
  if (input.restSeconds !== null && (!Number.isInteger(input.restSeconds) || input.restSeconds < 0 || input.restSeconds > 3600)) return "El descanso debe estar entre 0 y 3600 segundos.";
  if (!Number.isInteger(input.order) || input.order < 1 || input.order > 999) return "El orden debe ser un entero entre 1 y 999.";
  if ((input.observations?.length ?? 0) > 1000) return "Las observaciones del ejercicio son demasiado extensas.";
  if (!validUrl(input.videoUrl)) return "La URL del video debe comenzar con http o https.";
  return null;
}

export function validateRoutine(input: RoutineInput) {
  if (!input.name?.trim() || input.name.trim().length > 120) return "Ingresá un nombre de rutina de hasta 120 caracteres.";
  if (!input.objective?.trim() || input.objective.trim().length > 100) return "Seleccioná un objetivo válido.";
  if (!levels.includes(input.level)) return "Seleccioná un nivel válido.";
  if (!statuses.includes(input.status)) return "Seleccioná un estado válido.";
  if (!Array.isArray(input.studentIds) || input.studentIds.length === 0) return "Asigná la rutina al menos a un alumno.";
  if (new Set(input.studentIds).size !== input.studentIds.length || input.studentIds.some((id) => !id?.trim())) return "La asignación de alumnos no es válida.";
  if (!Array.isArray(input.days) || input.days.length !== 7) return "La rutina debe incluir los días 1 al 7.";
  const dayNumbers = input.days.map((day) => day.dayNumber);
  if (new Set(dayNumbers).size !== 7 || dayNumbers.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) return "Los días de la rutina no son válidos.";
  for (const day of input.days) {
    if (!Array.isArray(day.exercises)) return `Los ejercicios del día ${day.dayNumber} no son válidos.`;
    for (const exercise of day.exercises) {
      const error = validateExercise(exercise);
      if (error) return `Día ${day.dayNumber}: ${error}`;
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
    order: input.order,
  };
}

export function routineData(input: RoutineInput) {
  return {
    name: input.name.trim(),
    objective: input.objective.trim(),
    level: levelToDatabase[input.level],
    status: statusToDatabase[input.status],
  };
}

export function nestedDays(days: RoutineDayInput[]) {
  return days.sort((a, b) => a.dayNumber - b.dayNumber).map((day) => ({
    dayNumber: day.dayNumber,
    exercises: { create: [...day.exercises].sort((a, b) => a.order - b.order).map(exerciseData) },
  }));
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
    order: record.order,
  };
}

export function serializeRoutine(record: RoutineWithRelations): TrainingRoutine {
  const students = record.assignments.map((assignment) => {
    const student = assignment.student.data as unknown as Student;
    return { id: assignment.studentId, name: `${student.firstName} ${student.lastName}`.trim() };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    id: record.id,
    name: record.name,
    objective: record.objective,
    level: levelFromDatabase[record.level],
    status: statusFromDatabase[record.status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    studentIds: students.map((student) => student.id),
    students,
    days: record.days.map((day) => ({ id: day.id, dayNumber: day.dayNumber, exercises: day.exercises.map(serializeExercise) })),
  };
}

export function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}
