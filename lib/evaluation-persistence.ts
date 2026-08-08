import { Prisma } from "@prisma/client";
import { calculateAgeAtDate, calculateEvaluationCompletion, validateEvaluationDraft } from "@/lib/evaluation-workflow";
import type { EvaluationDraftInput, EvaluationWorkflow } from "@/types/evaluation-workflow";
import { normalizeEvaluation } from "@/lib/evaluation-read-model";
import type { NormalizedEvaluation } from "@/types/evaluation-read-model";

export const evaluationInclude = {
  student: true,
  measurements: { orderBy: { createdAt: "asc" as const } },
  bodyIssues: { orderBy: { createdAt: "asc" as const } },
  testResults: { orderBy: [{ category: "asc" as const }, { createdAt: "asc" as const }] },
} satisfies Prisma.PhysicalEvaluationInclude;

export type EvaluationRecordWithDetails = Prisma.PhysicalEvaluationGetPayload<{ include: typeof evaluationInclude }>;

function number(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

function object(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function serializeWorkflowEvaluation(record: EvaluationRecordWithDetails): EvaluationWorkflow {
  const student = record.student.data as Record<string, unknown>;
  const savedGeneralData = object(record.generalData);
  const calculatedAge = calculateAgeAtDate(typeof student.birthDate === "string" ? student.birthDate : "", record.date.toISOString().slice(0, 10));
  const generalData = {
    ...savedGeneralData,
    ...(savedGeneralData.ageSnapshot === undefined && calculatedAge !== null ? { ageSnapshot: calculatedAge } : {}),
    ...(savedGeneralData.weight === undefined && record.weight !== null ? { weight: Number(record.weight) } : {}),
    ...(savedGeneralData.height === undefined && record.height !== null ? { height: Number(record.height) } : {}),
    ...(savedGeneralData.bodyFatPercentage === undefined && record.bodyFatPercentage !== null ? { bodyFatPercentage: Number(record.bodyFatPercentage) } : {}),
  };
  return {
    id: record.id,
    studentId: record.studentId,
    studentName: `${String(student.firstName ?? "")} ${String(student.lastName ?? "")}`.trim(),
    version: record.version,
    status: record.status,
    date: record.date.toISOString().slice(0, 10),
    currentStep: record.currentStep,
    completionPercentage: record.completionPercentage,
    trainerName: record.trainerName,
    primaryGoal: record.primaryGoal,
    secondaryGoals: strings(record.secondaryGoals),
    experienceLevel: record.experienceLevel,
    weeklyAvailability: record.weeklyAvailability,
    generalData,
    habits: object(record.habits),
    trainingObservations: object(record.trainingObservations),
    trainerNotes: record.trainerNotes,
    finalStrengths: record.finalStrengths,
    finalPriorities: record.finalPriorities,
    finalLimitations: record.finalLimitations,
    planningNotes: record.planningNotes,
    finalComment: record.finalComment,
    reassessmentDate: record.reassessmentDate?.toISOString().slice(0, 10) ?? "",
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    measurements: record.measurements.map((item) => ({ id: item.id, measurementType: item.measurementType, side: item.side, value: Number(item.value), unit: item.unit, notes: item.notes })),
    bodyIssues: record.bodyIssues.map((item) => ({ id: item.id, bodyZone: item.bodyZone, side: item.side, intensity: item.intensity, hasPain: item.hasPain, status: item.status, studentDescription: item.studentDescription, trainerObservation: item.trainerObservation, approximateDate: item.approximateDate })),
    testResults: record.testResults.map((item) => ({ id: item.id, testKey: item.testKey, category: item.category as "MOBILITY" | "PHYSICAL", status: item.status, numericValue: number(item.numericValue), unit: item.unit, rightValue: number(item.rightValue), leftValue: number(item.leftValue), rightUnit: item.rightUnit, leftUnit: item.leftUnit, pain: item.pain, rightPain: item.rightPain, leftPain: item.leftPain, protocol: item.protocol, variation: item.variation, observations: item.observations, compensations: item.compensations, notPerformedReason: item.notPerformedReason, rawResult: object(item.rawResult) as Record<string, string | number | boolean | null> })),
  };
}

export function normalizePhysicalEvaluation(record: EvaluationRecordWithDetails): NormalizedEvaluation {
  const workflow = serializeWorkflowEvaluation(record);
  return normalizeEvaluation({
    ...workflow,
    weight: record.weight,
    height: record.height,
    bodyFatPercentage: record.bodyFatPercentage,
    muscleMass: record.muscleMass,
    visceralFat: record.visceralFat,
    waist: record.waist,
    hip: record.hip,
    chest: record.chest,
    rightArm: record.rightArm,
    leftArm: record.leftArm,
    rightThigh: record.rightThigh,
    leftThigh: record.leftThigh,
    rightCalf: record.rightCalf,
    leftCalf: record.leftCalf,
    source: "PHYSICAL",
  });
}

export function normalizeLegacyEvaluationRecord(record: { id: string; data: Prisma.JsonValue; createdAt: Date }): NormalizedEvaluation {
  const saved = object(record.data);
  const nested = object(saved.data as Prisma.JsonValue);
  return normalizeEvaluation({ ...saved, ...nested, id: saved.id ?? record.id, createdAt: saved.createdAt ?? record.createdAt.toISOString(), source: "LEGACY_JSON" });
}

export function workflowSummary(record: EvaluationRecordWithDetails) {
  const serialized = serializeWorkflowEvaluation(record);
  return {
    id: serialized.id, studentId: serialized.studentId, studentName: serialized.studentName,
    version: serialized.version, status: serialized.status, date: serialized.date,
    currentStep: serialized.currentStep, completionPercentage: serialized.completionPercentage,
    trainerName: serialized.trainerName, primaryGoal: serialized.primaryGoal,
    reassessmentDate: serialized.reassessmentDate, completedAt: serialized.completedAt, createdAt: serialized.createdAt, updatedAt: serialized.updatedAt,
  };
}

function decimalValue(input: EvaluationDraftInput, type: string, side: string | null = null) {
  return input.measurements.find((item) => item.measurementType === type && item.side === side)?.value ?? null;
}

export function workflowUpdateData(input: EvaluationDraftInput) {
  const validationError = validateEvaluationDraft(input);
  if (validationError) return { error: validationError, data: null };
  const completionPercentage = calculateEvaluationCompletion(input);
  return {
    error: null,
    data: {
      date: new Date(`${input.date}T12:00:00.000Z`),
      currentStep: input.currentStep,
      completionPercentage,
      trainerName: input.trainerName.trim() || "Entrenador",
      primaryGoal: input.primaryGoal.trim(),
      secondaryGoals: input.secondaryGoals as Prisma.InputJsonValue,
      experienceLevel: input.experienceLevel.trim(),
      weeklyAvailability: input.weeklyAvailability.trim(),
      generalData: input.generalData as Prisma.InputJsonValue,
      habits: input.habits as Prisma.InputJsonValue,
      trainingObservations: input.trainingObservations as Prisma.InputJsonValue,
      trainerNotes: input.trainerNotes.trim(),
      finalStrengths: input.finalStrengths.trim(),
      finalPriorities: input.finalPriorities.trim(),
      finalLimitations: input.finalLimitations.trim(),
      planningNotes: input.planningNotes.trim(),
      finalComment: input.finalComment.trim(),
      reassessmentDate: input.reassessmentDate ? new Date(`${input.reassessmentDate}T12:00:00.000Z`) : null,
      weight: decimalValue(input, "WEIGHT"),
      bodyFatPercentage: decimalValue(input, "BODY_FAT"),
      waist: decimalValue(input, "WAIST"),
      hip: decimalValue(input, "HIP"),
      chest: decimalValue(input, "CHEST"),
      rightArm: decimalValue(input, "ARM", "RIGHT"),
      leftArm: decimalValue(input, "ARM", "LEFT"),
      rightThigh: decimalValue(input, "THIGH", "RIGHT"),
      leftThigh: decimalValue(input, "THIGH", "LEFT"),
      rightCalf: decimalValue(input, "CALF", "RIGHT"),
      leftCalf: decimalValue(input, "CALF", "LEFT"),
      measurements: { deleteMany: {}, create: input.measurements.map((item) => ({ measurementType: item.measurementType, side: item.side, value: item.value, unit: item.unit, notes: item.notes.trim() })) },
      bodyIssues: { deleteMany: {}, create: input.bodyIssues.map((item) => ({ bodyZone: item.bodyZone, side: item.side, intensity: item.intensity, hasPain: item.hasPain, status: item.status, studentDescription: item.studentDescription.trim(), trainerObservation: item.trainerObservation.trim(), approximateDate: item.approximateDate.trim() })) },
      testResults: { deleteMany: {}, create: input.testResults.map((item) => ({ testKey: item.testKey, category: item.category, status: item.status, numericValue: item.numericValue, unit: item.unit, rightValue: item.rightValue, leftValue: item.leftValue, rightUnit: item.rightUnit, leftUnit: item.leftUnit, pain: item.pain, rightPain: item.rightPain, leftPain: item.leftPain, protocol: item.protocol.trim(), variation: item.variation.trim(), observations: item.observations.trim(), compensations: item.compensations.trim(), notPerformedReason: item.notPerformedReason.trim(), rawResult: item.rawResult as Prisma.InputJsonValue })) },
    },
  };
}
