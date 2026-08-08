import type { EvaluationBodyIssueValue, EvaluationMeasurementValue, EvaluationTestValue } from "../types/evaluation-workflow.ts";
import type { EvaluationMetricKey, NormalizedEvaluation, StudentEvaluation } from "../types/evaluation-read-model.ts";

type JsonObject = Record<string, unknown>;

export type EvaluationNormalizationInput = Partial<Record<EvaluationMetricKey, unknown>> & {
  id?: unknown; studentId?: unknown; studentName?: unknown; date?: unknown; version?: unknown; status?: unknown;
  completionPercentage?: unknown; trainerName?: unknown; primaryGoal?: unknown; secondaryGoals?: unknown;
  experienceLevel?: unknown; weeklyAvailability?: unknown; reassessmentDate?: unknown; createdAt?: unknown;
  generalData?: unknown; habits?: unknown; bodyIssues?: unknown; testResults?: unknown; measurements?: unknown;
  finalStrengths?: unknown; finalPriorities?: unknown; finalLimitations?: unknown; planningNotes?: unknown; finalComment?: unknown;
  source?: "PHYSICAL" | "LEGACY_JSON";
  bodyFat?: unknown;
};

function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : []; }
function number(value: unknown) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function integer(value: unknown, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback; }
function date(value: unknown) { const candidate = string(value).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : ""; }

function measurement(items: EvaluationMeasurementValue[], type: string, side: string | null = null) {
  return number(items.find((item) => item.measurementType === type && (item.side ?? null) === side)?.value);
}

function safeMeasurements(value: unknown): EvaluationMeasurementValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = object(item); const numericValue = number(candidate.value); const type = string(candidate.measurementType);
    if (!type || numericValue === null) return [];
    return [{ id: string(candidate.id) || undefined, measurementType: type, side: string(candidate.side) || null, value: numericValue, unit: string(candidate.unit), notes: string(candidate.notes) }];
  });
}

function safeBodyIssues(value: unknown): EvaluationBodyIssueValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const candidate = object(item); const bodyZone = string(candidate.bodyZone); if (!bodyZone) return []; const rawIntensity = candidate.intensity === null || candidate.intensity === undefined ? NaN : Number(candidate.intensity); const intensity = Number.isInteger(rawIntensity) && rawIntensity >= 0 && rawIntensity <= 10 ? rawIntensity : null; return [{ id: string(candidate.id) || undefined, bodyZone, side: string(candidate.side) || "CENTER", intensity, hasPain: candidate.hasPain === true, status: string(candidate.status) || "NOT_SPECIFIED", studentDescription: string(candidate.studentDescription), trainerObservation: string(candidate.trainerObservation), approximateDate: string(candidate.approximateDate) }]; });
}

function safeTests(value: unknown): EvaluationTestValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const candidate = object(item); const testKey = string(candidate.testKey); const category = string(candidate.category); if (!testKey || (category !== "MOBILITY" && category !== "PHYSICAL")) return []; return [{ id: string(candidate.id) || undefined, testKey, category, status: string(candidate.status) || "NOT_PERFORMED", numericValue: number(candidate.numericValue), unit: string(candidate.unit), rightValue: number(candidate.rightValue), leftValue: number(candidate.leftValue), rightUnit: string(candidate.rightUnit), leftUnit: string(candidate.leftUnit), pain: candidate.pain === true, rightPain: candidate.rightPain === true, leftPain: candidate.leftPain === true, protocol: string(candidate.protocol), variation: string(candidate.variation), observations: string(candidate.observations), compensations: string(candidate.compensations), notPerformedReason: string(candidate.notPerformedReason), rawResult: object(candidate.rawResult) as Record<string, string | number | boolean | null> }]; });
}

export function normalizeEvaluation(input: EvaluationNormalizationInput): NormalizedEvaluation {
  const general = object(input.generalData);
  const habits = object(input.habits);
  const measurements = safeMeasurements(input.measurements);
  const pick = (type: string, flat: unknown, generalKey: string, side: string | null = null) => measurement(measurements, type, side) ?? number(general[generalKey]) ?? number(flat);
  const weight = pick("WEIGHT", input.weight, "weight");
  const height = number(general.height) ?? number(input.height);
  const bodyFatPercentage = measurement(measurements, "BODY_FAT") ?? number(general.bodyFatPercentage) ?? number(general.bodyFat) ?? number(input.bodyFatPercentage) ?? number(input.bodyFat);
  const bmi = weight !== null && height !== null && height >= 0.8 && height <= 2.5 ? Math.round(weight / (height * height) * 10) / 10 : null;
  const status = input.status === "IN_PROGRESS" || input.status === "REASSESSMENT_RECOMMENDED" ? input.status : "COMPLETED";
  return {
    id: string(input.id), studentId: string(input.studentId), studentName: string(input.studentName), date: date(input.date),
    version: integer(input.version, 1), status, completionPercentage: Math.min(100, integer(input.completionPercentage, status === "IN_PROGRESS" ? 0 : 100)),
    trainerName: string(input.trainerName) || "Entrenador", primaryGoal: string(input.primaryGoal), secondaryGoals: strings(input.secondaryGoals),
    experienceLevel: string(input.experienceLevel), weeklyAvailability: string(input.weeklyAvailability), reassessmentDate: date(input.reassessmentDate),
    weight, height, age: number(general.ageSnapshot) ?? number(input.age), bmi, bodyFatPercentage,
    muscleMass: number(input.muscleMass), visceralFat: number(input.visceralFat),
    waist: pick("WAIST", input.waist, "waist"), hip: pick("HIP", input.hip, "hip"), chest: pick("CHEST", input.chest, "chest"),
    rightArm: pick("ARM", input.rightArm, "rightArm", "RIGHT"), leftArm: pick("ARM", input.leftArm, "leftArm", "LEFT"),
    rightThigh: pick("THIGH", input.rightThigh, "rightThigh", "RIGHT"), leftThigh: pick("THIGH", input.leftThigh, "leftThigh", "LEFT"),
    rightCalf: pick("CALF", input.rightCalf, "rightCalf", "RIGHT"), leftCalf: pick("CALF", input.leftCalf, "leftCalf", "LEFT"),
    activities: string(general.activities), habits, bodyIssues: safeBodyIssues(input.bodyIssues), testResults: safeTests(input.testResults),
    finalStrengths: string(input.finalStrengths), finalPriorities: string(input.finalPriorities), finalLimitations: string(input.finalLimitations),
    planningNotes: string(input.planningNotes), finalComment: string(input.finalComment), createdAt: string(input.createdAt), source: input.source ?? "PHYSICAL",
  };
}

export function deduplicateEvaluations(items: NormalizedEvaluation[]) {
  const seenIds = new Set<string>();
  const physicalFingerprints = new Set(items.filter((item) => item.source === "PHYSICAL" && item.studentId && item.date).map((item) => `${item.studentId}|${item.date}`));
  const legacyFingerprints = new Set<string>();
  return [...items].sort((left, right) => right.date.localeCompare(left.date) || right.version - left.version).filter((item) => {
    const fingerprint = `${item.studentId}|${item.date}`;
    if (item.id && seenIds.has(item.id)) return false;
    if (item.source === "LEGACY_JSON" && item.studentId && item.date && (physicalFingerprints.has(fingerprint) || legacyFingerprints.has(fingerprint))) return false;
    if (item.id) seenIds.add(item.id);
    if (item.source === "LEGACY_JSON" && item.studentId && item.date) legacyFingerprints.add(fingerprint);
    return true;
  });
}

export function chronologicalMetric(items: NormalizedEvaluation[], key: EvaluationMetricKey) {
  return items.flatMap((item) => typeof item[key] === "number" ? [{ id: item.id, date: item.date, value: item[key] as number }] : []).sort((left, right) => left.date.localeCompare(right.date));
}

export function comparableTestChange(current: EvaluationTestValue, previous: EvaluationTestValue | undefined) {
  if (!previous || current.testKey !== previous.testKey || current.category !== previous.category || current.unit !== previous.unit || current.variation !== previous.variation || current.protocol !== previous.protocol || current.numericValue === null || previous.numericValue === null) return null;
  return Math.round((current.numericValue - previous.numericValue) * 100) / 100;
}

export function toStudentEvaluation(item: NormalizedEvaluation): StudentEvaluation {
  const publicData = { ...item };
  delete (publicData as Partial<NormalizedEvaluation>).trainerName;
  delete (publicData as Partial<NormalizedEvaluation>).habits;
  delete (publicData as Partial<NormalizedEvaluation>).finalStrengths;
  delete (publicData as Partial<NormalizedEvaluation>).finalPriorities;
  delete (publicData as Partial<NormalizedEvaluation>).finalLimitations;
  delete (publicData as Partial<NormalizedEvaluation>).planningNotes;
  delete (publicData as Partial<NormalizedEvaluation>).finalComment;
  return { ...publicData, bodyIssues: item.bodyIssues.map((issue) => ({ ...issue, trainerObservation: "" })), testResults: item.testResults.map((test) => ({ ...test, observations: "", compensations: "", protocol: "", rawResult: {} })) } as StudentEvaluation;
}
