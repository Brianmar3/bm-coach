import "server-only";

import { Prisma, type AttendanceStatus as PrismaAttendanceStatus, type ClassWeekday } from "@prisma/client";
import type { AttendanceEntry, AttendanceStatus, Student } from "@/types/gestion";

export const attendanceStudentInclude = { student: true } satisfies Prisma.ClassAttendanceInclude;
export type AttendanceWithStudent = Prisma.ClassAttendanceGetPayload<{ include: typeof attendanceStudentInclude }>;

const STATUS_TO_DB: Record<AttendanceStatus, PrismaAttendanceStatus> = { presente: "PRESENT", ausente: "ABSENT", justificado: "JUSTIFIED" };
const STATUS_FROM_DB: Record<PrismaAttendanceStatus, AttendanceStatus> = { PRESENT: "presente", ABSENT: "ausente", JUSTIFIED: "justificado" };
const JS_DAY_TO_CLASS: Partial<Record<number, ClassWeekday>> = { 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY" };

export function attendanceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function classDayForDate(date: Date) {
  return JS_DAY_TO_CLASS[date.getUTCDay()] ?? null;
}

export function attendanceStatus(value: unknown): AttendanceStatus | null {
  return value === "presente" || value === "ausente" || value === "justificado" ? value : null;
}

export function databaseAttendanceStatus(value: AttendanceStatus) {
  return STATUS_TO_DB[value];
}

export function apiAttendanceStatus(value: PrismaAttendanceStatus) {
  return STATUS_FROM_DB[value];
}

export function studentName(value: Prisma.JsonValue) {
  const student = value as unknown as Partial<Student>;
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

export function serializeAttendance(record: AttendanceWithStudent, assigned = true): AttendanceEntry {
  return {
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    status: apiAttendanceStatus(record.status),
    studentId: record.studentId,
    studentName: studentName(record.student.data),
    scheduleId: record.scheduleId ?? "",
    scheduleLabel: record.scheduleLabel,
    scheduleStartTime: record.scheduleStartTime,
    exceptional: !assigned,
  };
}

export function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== month) return null;
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}
