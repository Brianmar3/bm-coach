import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CoachSettings, Student, StudentPlanOption, StudentStatus } from "@/types/gestion";

const PLAN_DAYS = [2, 3, 4, 5] as const;
const DAY_LABELS = { MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves", FRIDAY: "Viernes" } as const;

export const studentInclude = { primarySchedule: true } satisfies Prisma.StudentRecordInclude;
export type StudentWithSchedule = Prisma.StudentRecordGetPayload<{ include: typeof studentInclude }>;

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function planDays(value: string) {
  const match = value.match(/(?:^|\D)([2-5])(?:\D|$)/);
  return match ? Number(match[1]) as 2 | 3 | 4 | 5 : null;
}

export function monthlyDueDate(startDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.getUTCFullYear() !== year || original.getUTCMonth() !== month - 1 || original.getUTCDate() !== day) return "";
  const lastTargetDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastTargetDay))).toISOString().slice(0, 10);
}

export function weeklyScheduleLabel(schedule: { dayOfWeek: keyof typeof DAY_LABELS; startTime: string; endTime: string; classType: string }) {
  return `${DAY_LABELS[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · ${schedule.classType}`;
}

export async function getStudentPlanOptions(): Promise<StudentPlanOption[]> {
  const [settingsRecord, studentRecords] = await Promise.all([
    prisma.coachSettingsRecord.findFirst({ orderBy: { updatedAt: "desc" }, select: { data: true } }),
    prisma.studentRecord.findMany({ orderBy: { updatedAt: "desc" }, select: { data: true } }),
  ]);
  const settings = settingsRecord?.data as unknown as CoachSettings | undefined;
  return PLAN_DAYS.map((days) => {
    const configuredPlan = settings?.plans?.find((item) => planDays(item.name) === days && Number.isFinite(item.price) && item.price >= 0);
    const existingStudent = studentRecords
      .map((record) => record.data as unknown as Student)
      .find((student) => planDays(student.plan ?? "") === days && Number.isFinite(student.monthlyFee) && student.monthlyFee > 0);
    const price = configuredPlan?.price ?? existingStudent?.monthlyFee ?? 0;
    return { days, name: `${days} días por semana`, price, configured: Boolean(configuredPlan || existingStudent) };
  });
}

export function serializeStudent(record: StudentWithSchedule): Student {
  const stored = record.data as unknown as Partial<Omit<Student, "id">>;
  return {
    firstName: stored.firstName ?? "",
    lastName: stored.lastName ?? "",
    phone: stored.phone ?? "",
    email: stored.email ?? "",
    birthDate: stored.birthDate ?? "",
    weight: Number(stored.weight ?? 0),
    height: Number(stored.height ?? 0),
    goal: stored.goal ?? "",
    plan: stored.plan ?? "",
    monthlyFee: Number(stored.monthlyFee ?? 0),
    joinedAt: stored.joinedAt ?? "",
    dueDate: stored.dueDate ?? "",
    status: stored.status === "inactivo" ? "inactivo" : "activo",
    notes: stored.notes ?? "",
    id: record.id,
    scheduleId: record.primaryScheduleId ?? "",
    scheduleLabel: record.primarySchedule ? weeklyScheduleLabel(record.primarySchedule) : "Sin horario principal",
  };
}

export type ParsedStudentInput = Omit<Student, "id" | "scheduleLabel"> & { scheduleId: string };

export function parseStudentInput(value: unknown, plans: StudentPlanOption[]): { data: ParsedStudentInput; error: null } | { data: null; error: string } {
  if (!value || typeof value !== "object") return { data: null, error: "Los datos del alumno no son válidos." };
  const input = value as Record<string, unknown>;
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const joinedAt = typeof input.joinedAt === "string" ? input.joinedAt : "";
  const scheduleId = typeof input.scheduleId === "string" ? input.scheduleId : "";
  const status = input.status as StudentStatus;
  const requestedDays = typeof input.planDays === "number" ? input.planDays : planDays(typeof input.plan === "string" ? input.plan : "");
  const selectedPlan = plans.find((plan) => plan.days === requestedDays);

  if (!firstName || !lastName) return { data: null, error: "Ingresá nombre y apellido." };
  if (!phone || normalizePhone(phone).length < 6) return { data: null, error: "Ingresá un teléfono válido de al menos 6 dígitos." };
  if (!selectedPlan) return { data: null, error: "Seleccioná un plan mensual de 2, 3, 4 o 5 días por semana." };
  if (!monthlyDueDate(joinedAt)) return { data: null, error: "Ingresá una fecha de inicio válida." };
  if (!scheduleId) return { data: null, error: "Seleccioná un horario o grupo." };
  if (!(status === "activo" || status === "inactivo")) return { data: null, error: "Seleccioná un estado válido." };

  const weight = input.weight === "" || input.weight === undefined ? 0 : Number(input.weight);
  const height = input.height === "" || input.height === undefined ? 0 : Number(input.height);
  if (!Number.isFinite(weight) || weight < 0 || weight > 500) return { data: null, error: "El peso debe estar entre 0 y 500 kg." };
  if (!Number.isFinite(height) || height < 0 || height > 3) return { data: null, error: "La altura debe estar entre 0 y 3 metros." };
  const birthDate = typeof input.birthDate === "string" ? input.birthDate : "";
  if (birthDate && (!monthlyDueDate(birthDate) || birthDate > new Date().toISOString().slice(0, 10))) return { data: null, error: "La fecha de nacimiento no es válida." };

  return {
    data: {
      firstName,
      lastName,
      phone,
      email: typeof input.email === "string" ? input.email.trim() : "",
      birthDate,
      weight,
      height,
      goal: typeof input.goal === "string" ? input.goal.trim() : "",
      plan: selectedPlan.name,
      monthlyFee: selectedPlan.price,
      joinedAt,
      dueDate: monthlyDueDate(joinedAt),
      status,
      notes: typeof input.notes === "string" ? input.notes.trim() : "",
      scheduleId,
    },
    error: null,
  };
}

export function studentJsonData(input: ParsedStudentInput): Prisma.InputJsonObject {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    birthDate: input.birthDate,
    weight: input.weight,
    height: input.height,
    goal: input.goal,
    plan: input.plan,
    monthlyFee: input.monthlyFee,
    joinedAt: input.joinedAt,
    dueDate: input.dueDate,
    status: input.status,
    notes: input.notes,
  };
}

export async function duplicatePhone(transaction: Prisma.TransactionClient, normalizedPhone: string, excludeId?: string) {
  const records = await transaction.studentRecord.findMany({ where: excludeId ? { id: { not: excludeId } } : undefined, select: { id: true, phoneNormalized: true, data: true } });
  return records.find((record) => record.phoneNormalized === normalizedPhone || normalizePhone(((record.data as unknown as Partial<Student>).phone ?? "")) === normalizedPhone) ?? null;
}
