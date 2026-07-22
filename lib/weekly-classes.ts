import "server-only";

import { Prisma } from "@prisma/client";
import type { Student, WeeklyClassDay, WeeklyClassInput, WeeklyClassSchedule, WeeklyClassStudent } from "@/types/gestion";

export const WEEKDAYS: WeeklyClassDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export const weeklyClassInclude = {
  assignments: { include: { student: true } },
} satisfies Prisma.WeeklyClassScheduleInclude;

export type WeeklyClassWithStudents = Prisma.WeeklyClassScheduleGetPayload<{ include: typeof weeklyClassInclude }>;

function studentSummary(id: string, value: Prisma.JsonValue): WeeklyClassStudent {
  const student = value as unknown as Student;
  return {
    id,
    name: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre",
    status: student.status === "inactivo" ? "inactivo" : "activo",
  };
}

export function serializeWeeklyClass(schedule: WeeklyClassWithStudents): WeeklyClassSchedule {
  const students = schedule.assignments
    .map((assignment) => studentSummary(assignment.studentId, assignment.student.data))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  return {
    id: schedule.id,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    classType: schedule.classType,
    capacity: schedule.capacity,
    active: schedule.active,
    studentIds: students.map((student) => student.id),
    students,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export function parseWeeklyClassInput(value: unknown): { data: WeeklyClassInput; error: null } | { data: null; error: string } {
  if (!value || typeof value !== "object") return { data: null, error: "Los datos del horario no son válidos." };
  const input = value as Record<string, unknown>;
  const dayOfWeek = typeof input.dayOfWeek === "string" ? input.dayOfWeek : "";
  const startTime = typeof input.startTime === "string" ? input.startTime : "";
  const endTime = typeof input.endTime === "string" ? input.endTime : "";
  const classType = typeof input.classType === "string" ? input.classType.trim() : "";
  const active = typeof input.active === "boolean" ? input.active : true;
  const capacity = input.capacity === null || input.capacity === undefined || input.capacity === "" ? null : Number(input.capacity);
  const studentIds = Array.isArray(input.studentIds) && input.studentIds.every((id) => typeof id === "string")
    ? [...new Set(input.studentIds.map((id) => id.trim()).filter(Boolean))]
    : null;

  if (!WEEKDAYS.includes(dayOfWeek as WeeklyClassDay)) return { data: null, error: "Seleccioná un día de lunes a viernes." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return { data: null, error: "Ingresá horarios válidos." };
  if (endTime <= startTime) return { data: null, error: "La hora de finalización debe ser posterior al inicio." };
  if (!classType || classType.length > 120) return { data: null, error: "Ingresá un tipo de clase de hasta 120 caracteres." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) return { data: null, error: "El cupo debe ser un número entero entre 1 y 500, o quedar vacío." };
  if (!studentIds) return { data: null, error: "La lista de alumnos no es válida." };
  if (capacity !== null && studentIds.length > capacity) return { data: null, error: "La cantidad de alumnos supera el cupo configurado." };

  return { data: { dayOfWeek: dayOfWeek as WeeklyClassDay, startTime, endTime, classType, capacity, active, studentIds }, error: null };
}

export async function studentsExist(transaction: Prisma.TransactionClient, studentIds: string[]) {
  if (studentIds.length === 0) return true;
  const count = await transaction.studentRecord.count({ where: { id: { in: studentIds } } });
  return count === studentIds.length;
}
