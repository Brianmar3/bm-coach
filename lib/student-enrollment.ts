import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDateKey } from "@/lib/payment-dates";
import { isStudentType } from "@/types/gestion";
import type { CoachSettings, Student, StudentPlanOption, StudentStatus, StudentType } from "@/types/gestion";
import { isStudentServiceType } from "@/lib/student-service";
import { isPersistentPlanId, resolveStudentPlan, studentPlanOptions } from "@/lib/coach-plans";

const DAY_LABELS = { MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves", FRIDAY: "Viernes" } as const;

export const studentInclude = {
  primarySchedule: true,
  weeklyClasses: { where: { active: true }, include: { schedule: true }, orderBy: { assignedAt: "asc" } },
} satisfies Prisma.StudentRecordInclude;
export type StudentWithSchedule = Prisma.StudentRecordGetPayload<{ include: typeof studentInclude }>;

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function studentTypeValue(value: unknown): StudentType {
  return isStudentType(value) ? value : "Adulto";
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
  const settingsRecord = await prisma.coachSettingsRecord.findFirst({ orderBy: { updatedAt: "desc" }, select: { data: true } });
  const settings = settingsRecord?.data as unknown as CoachSettings | undefined;
  return studentPlanOptions(settings);
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
    planId: typeof stored.planId === "string" ? stored.planId : "",
    monthlyFee: Number(stored.monthlyFee ?? 0),
    joinedAt: stored.joinedAt ?? "",
    dueDate: stored.dueDate ?? "",
    status: stored.lifecycleStatus === "suspendido" ? "suspendido" : stored.status === "inactivo" ? "inactivo" : "activo",
    serviceType: record.serviceType,
    notes: stored.notes ?? "",
    studentType: studentTypeValue(stored.studentType),
    responsibleName: typeof stored.responsibleName === "string" ? stored.responsibleName : "",
    responsiblePhone: typeof stored.responsiblePhone === "string" ? stored.responsiblePhone : "",
    responsibleRelation: typeof stored.responsibleRelation === "string" ? stored.responsibleRelation : "",
    flexibleSchedule: typeof stored.flexibleSchedule === "string" ? stored.flexibleSchedule : "",
    profileImageUrl: typeof stored.profileImageUrl === "string" ? stored.profileImageUrl : "",
    id: record.id,
    scheduleId: record.primaryScheduleId ?? "",
    scheduleLabel: record.primarySchedule ? weeklyScheduleLabel(record.primarySchedule) : "Sin horario principal",
    scheduleIds: record.weeklyClasses.map((assignment) => assignment.scheduleId),
    scheduleLabels: record.weeklyClasses.map((assignment) => weeklyScheduleLabel(assignment.schedule)),
  };
}

export type ParsedStudentInput = Omit<Student, "id" | "scheduleLabel" | "scheduleLabels"> & { scheduleId: string; scheduleIds: string[]; flexibleSchedule: string };

export function parseStudentInput(value: unknown, plans: StudentPlanOption[]): { data: ParsedStudentInput; error: null } | { data: null; error: string } {
  if (!value || typeof value !== "object") return { data: null, error: "Los datos del alumno no son válidos." };
  const input = value as Record<string, unknown>;
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const studentType = studentTypeValue(input.studentType);
  const responsibleName = typeof input.responsibleName === "string" ? input.responsibleName.trim() : "";
  const responsiblePhone = typeof input.responsiblePhone === "string" ? input.responsiblePhone.trim() : "";
  const responsibleRelation = typeof input.responsibleRelation === "string" ? input.responsibleRelation.trim() : "";
  const joinedAt = typeof input.joinedAt === "string" ? input.joinedAt : "";
  const dueDate = typeof input.dueDate === "string" ? input.dueDate : "";
  const scheduleId = typeof input.scheduleId === "string" ? input.scheduleId : "";
  const scheduleIds = Array.isArray(input.scheduleIds) && input.scheduleIds.every((id) => typeof id === "string")
    ? [...new Set(input.scheduleIds.map((id) => id.trim()).filter(Boolean))]
    : scheduleId ? [scheduleId] : [];
  const flexibleSchedule = typeof input.flexibleSchedule === "string" ? input.flexibleSchedule.trim().slice(0, 80) : "";
  const status = input.status as StudentStatus;
  const serviceType = isStudentServiceType(input.serviceType) ? input.serviceType : null;
  const requestedPlanId = typeof input.planId === "string" ? input.planId : "";
  const requestedPlanName = typeof input.plan === "string" ? input.plan.trim() : "";
  if (!firstName || !lastName) return { data: null, error: "Ingresá nombre y apellido." };
  if (studentType === "Adulto" && (!phone || normalizePhone(phone).length < 6)) return { data: null, error: "Ingresá un teléfono válido de al menos 6 dígitos." };
  if (studentType === "Kids" && phone && normalizePhone(phone).length < 6) return { data: null, error: "Ingresá un teléfono válido de al menos 6 dígitos." };
  if (!serviceType) return { data: null, error: "Seleccioná un tipo de servicio." };
  if (!requestedPlanName && !requestedPlanId) return { data: null, error: "Seleccioná un plan mensual." };
  const resolution = resolveStudentPlan({
    plan: requestedPlanName,
    planId: isPersistentPlanId(requestedPlanId) ? requestedPlanId : "",
    monthlyFee: Number(input.monthlyFee ?? 0),
  }, plans);
  if (resolution.status === "ambiguous") return { data: null, error: "El plan anterior coincide con más de un plan actual. Seleccioná uno manualmente." };
  if (resolution.status === "missing") return { data: null, error: "El plan seleccionado ya no existe." };
  const selectedPlan = resolution.plan;
  if (!isDateKey(joinedAt)) return { data: null, error: "Seleccioná una fecha de inicio válida." };
  if (dueDate && !isDateKey(dueDate)) return { data: null, error: "Ingresá un próximo vencimiento válido." };
  if (!(status === "activo" || status === "inactivo" || status === "suspendido")) return { data: null, error: "Seleccioná un estado válido." };

  const weight = input.weight === "" || input.weight === undefined ? 0 : Number(input.weight);
  const height = input.height === "" || input.height === undefined ? 0 : Number(input.height);
  if (!Number.isFinite(weight) || weight < 0 || weight > 500) return { data: null, error: "El peso debe estar entre 0 y 500 kg." };
  if (!Number.isFinite(height) || height < 0 || height > 3) return { data: null, error: "La altura debe estar entre 0 y 3 metros." };
  const birthDate = typeof input.birthDate === "string" ? input.birthDate : "";
  if (birthDate && (!isDateKey(birthDate) || birthDate > new Date().toISOString().slice(0, 10))) return { data: null, error: "La fecha de nacimiento no es válida." };

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
      planId: selectedPlan.persistentId,
      monthlyFee: selectedPlan.price,
      joinedAt,
      dueDate,
      status,
      serviceType,
      notes: typeof input.notes === "string" ? input.notes.trim() : "",
      studentType,
      responsibleName,
      responsiblePhone,
      responsibleRelation,
      scheduleId: scheduleIds[0] ?? "",
      scheduleIds,
      flexibleSchedule,
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
    planId: input.planId ?? "",
    monthlyFee: input.monthlyFee,
    joinedAt: input.joinedAt,
    dueDate: input.dueDate,
    status: input.status === "suspendido" ? "inactivo" : input.status,
    lifecycleStatus: input.status,
    serviceType: input.serviceType,
    notes: input.notes,
    studentType: input.studentType,
    responsibleName: input.responsibleName,
    responsiblePhone: input.responsiblePhone,
    responsibleRelation: input.responsibleRelation,
    flexibleSchedule: input.flexibleSchedule,
  };
}

export async function duplicatePhone(transaction: Prisma.TransactionClient, normalizedPhone: string, excludeId?: string) {
  if (!normalizedPhone) return null;
  const records = await transaction.studentRecord.findMany({ where: excludeId ? { id: { not: excludeId } } : undefined, select: { id: true, phoneNormalized: true, data: true } });
  return records.find((record) => record.phoneNormalized === normalizedPhone || normalizePhone(((record.data as unknown as Partial<Student>).phone ?? "")) === normalizedPhone) ?? null;
}
