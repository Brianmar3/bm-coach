import { Prisma } from "@prisma/client";
import type { PhysicalEvaluation, Student } from "@/types/gestion";

export type EvaluationInput = Omit<PhysicalEvaluation, "id" | "studentName" | "bmi" | "createdAt">;
export type EvaluationWithStudent = Prisma.PhysicalEvaluationGetPayload<{ include: { student: true } }>;

type NumericKey = keyof Pick<PhysicalEvaluation,
  "weight" | "height" | "bodyFatPercentage" | "muscleMass" | "visceralFat" |
  "waist" | "hip" | "chest" | "rightArm" | "leftArm" | "rightThigh" |
  "leftThigh" | "rightCalf" | "leftCalf"
>;

const numericRules: Array<{ key: NumericKey; label: string; min: number; max: number }> = [
  { key: "weight", label: "El peso", min: 20, max: 500 },
  { key: "height", label: "La altura", min: 0.8, max: 2.5 },
  { key: "bodyFatPercentage", label: "El porcentaje de grasa", min: 1, max: 75 },
  { key: "muscleMass", label: "La masa muscular", min: 1, max: 250 },
  { key: "visceralFat", label: "La grasa visceral", min: 0, max: 60 },
  { key: "waist", label: "La cintura", min: 10, max: 300 },
  { key: "hip", label: "La cadera", min: 10, max: 300 },
  { key: "chest", label: "El pecho", min: 10, max: 300 },
  { key: "rightArm", label: "El brazo derecho", min: 10, max: 300 },
  { key: "leftArm", label: "El brazo izquierdo", min: 10, max: 300 },
  { key: "rightThigh", label: "El muslo derecho", min: 10, max: 300 },
  { key: "leftThigh", label: "El muslo izquierdo", min: 10, max: 300 },
  { key: "rightCalf", label: "La pantorrilla derecha", min: 10, max: 300 },
  { key: "leftCalf", label: "La pantorrilla izquierda", min: 10, max: 300 },
];

function validUrl(value: string | undefined) {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEvaluation(input: EvaluationInput) {
  if (!input.studentId?.trim()) return "Seleccioná un alumno real.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return "Ingresá una fecha válida.";
  const parsedDate = new Date(`${input.date}T12:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.date) return "Ingresá una fecha válida.";
  if (input.date < "1900-01-01" || input.date > new Date().toISOString().slice(0, 10)) return "La fecha debe estar entre 1900 y hoy.";

  for (const rule of numericRules) {
    const value = input[rule.key];
    if (value === null || value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < rule.min || value > rule.max) {
      return `${rule.label} debe estar entre ${rule.min} y ${rule.max}.`;
    }
  }

  if (![input.frontPhotoUrl, input.sidePhotoUrl, input.backPhotoUrl].every(validUrl)) {
    return "Las fotos deben usar URLs válidas con http o https.";
  }
  if ((input.notes?.length ?? 0) > 3000) return "Las observaciones no pueden superar los 3000 caracteres.";
  return null;
}

function decimal(value: number | null | undefined) {
  return value === null || value === undefined ? null : value;
}

export function evaluationData(input: EvaluationInput) {
  return {
    studentId: input.studentId,
    date: new Date(`${input.date}T12:00:00.000Z`),
    weight: decimal(input.weight),
    height: decimal(input.height),
    bodyFatPercentage: decimal(input.bodyFatPercentage),
    muscleMass: decimal(input.muscleMass),
    visceralFat: decimal(input.visceralFat),
    waist: decimal(input.waist),
    hip: decimal(input.hip),
    chest: decimal(input.chest),
    rightArm: decimal(input.rightArm),
    leftArm: decimal(input.leftArm),
    rightThigh: decimal(input.rightThigh),
    leftThigh: decimal(input.leftThigh),
    rightCalf: decimal(input.rightCalf),
    leftCalf: decimal(input.leftCalf),
    notes: input.notes?.trim() ?? "",
    frontPhotoUrl: input.frontPhotoUrl?.trim() || null,
    sidePhotoUrl: input.sidePhotoUrl?.trim() || null,
    backPhotoUrl: input.backPhotoUrl?.trim() || null,
  };
}

function number(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

export function serializeEvaluation(record: EvaluationWithStudent): PhysicalEvaluation {
  const student = record.student.data as unknown as Student;
  const weight = number(record.weight);
  const height = number(record.height);
  const bmi = weight !== null && height !== null && height > 0 ? Math.round((weight / (height * height)) * 10) / 10 : null;
  return {
    id: record.id,
    studentId: record.studentId,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    date: record.date.toISOString().slice(0, 10),
    weight,
    height,
    bmi,
    bodyFatPercentage: number(record.bodyFatPercentage),
    muscleMass: number(record.muscleMass),
    visceralFat: number(record.visceralFat),
    waist: number(record.waist),
    hip: number(record.hip),
    chest: number(record.chest),
    rightArm: number(record.rightArm),
    leftArm: number(record.leftArm),
    rightThigh: number(record.rightThigh),
    leftThigh: number(record.leftThigh),
    rightCalf: number(record.rightCalf),
    leftCalf: number(record.leftCalf),
    notes: record.notes,
    frontPhotoUrl: record.frontPhotoUrl ?? "",
    sidePhotoUrl: record.sidePhotoUrl ?? "",
    backPhotoUrl: record.backPhotoUrl ?? "",
    createdAt: record.createdAt.toISOString(),
  };
}

export function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}
