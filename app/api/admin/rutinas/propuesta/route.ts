import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { buildRoutineAIContext, exerciseAlternatives, generateRoutineAIProposal } from "@/lib/ai/routine-generation";
import { deduplicateEvaluations } from "@/lib/evaluation-read-model";
import { evaluationInclude, normalizeLegacyEvaluationRecord, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";
import { argentinaDateKey } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";
import type { RoutineAIConstraints, RoutineExerciseCatalogEntry } from "@/types/routine-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constraints(value: unknown): RoutineAIConstraints | null {
  if (!value || typeof value !== "object") return null; const raw = value as Record<string, unknown>; const requestedDays = Number(raw.requestedDays); const sessionMinutes = raw.sessionMinutes === null || raw.sessionMinutes === undefined ? null : Number(raw.sessionMinutes); const locations = ["SALON_BM", "FULL_GYM", "HOME", "CUSTOM"] as const;
  if (!Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 6 || sessionMinutes !== null && (!Number.isInteger(sessionMinutes) || sessionMinutes < 20 || sessionMinutes > 180) || !locations.includes(raw.location as typeof locations[number])) return null;
  return { requestedDays, sessionMinutes, location: raw.location as RoutineAIConstraints["location"], equipment: Array.isArray(raw.equipment) ? raw.equipment.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30) : [], trainerInstructions: typeof raw.trainerInstructions === "string" ? raw.trainerInstructions.trim().slice(0, 800) : "" };
}

async function catalog(): Promise<RoutineExerciseCatalogEntry[]> {
  const [routineExercises, quickLogs] = await Promise.all([
    prisma.trainingRoutineExercise.findMany({ where: { active: true, name: { not: "" } }, select: { name: true, alternativeExercise: true }, distinct: ["name"], take: 300 }),
    prisma.quickLog.findMany({ where: { exerciseName: { not: "" } }, select: { exerciseName: true }, distinct: ["exerciseName"], orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return [...routineExercises.map((item) => ({ name: item.name, aliases: item.alternativeExercise ? [item.alternativeExercise] : [] })), ...quickLogs.map((item) => ({ name: item.exerciseName, aliases: [] }))];
}

async function reserve(studentId: string, requestKey: string) {
  const dateKey = argentinaDateKey(); const feature = "routine_proposal"; const limit = Math.max(1, Math.min(Number(process.env.ROUTINE_AI_DAILY_LIMIT ?? process.env.NUTRITION_AI_DAILY_LIMIT) || 5, 30)); const key = `routine-ai:${studentId}:${requestKey}`;
  return prisma.$transaction(async (transaction) => {
    const usage = await transaction.nutritionAIUsage.upsert({ where: { studentId_dateKey_feature: { studentId, dateKey, feature } }, create: { studentId, dateKey, feature }, update: {} });
    if (usage.usedCount + usage.reservedCount >= limit) throw new Error("DAILY_LIMIT");
    try { await transaction.nutritionAIRequest.create({ data: { studentId, requestKey: key, dateKey, feature, expiresAt: new Date(Date.now() + 120000) } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("DUPLICATE_REQUEST"); throw error; }
    await transaction.nutritionAIUsage.update({ where: { id: usage.id }, data: { reservedCount: { increment: 1 } } });
    return { usageId: usage.id, key, feature };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function finalize(reservation: { usageId: string; key: string }, success: boolean, errorCode = "") {
  await prisma.$transaction([
    prisma.nutritionAIUsage.update({ where: { id: reservation.usageId }, data: success ? { reservedCount: { decrement: 1 }, usedCount: { increment: 1 } } : { reservedCount: { decrement: 1 } } }),
    prisma.nutritionAIRequest.update({ where: { requestKey: reservation.key }, data: { status: success ? "COMPLETED" : "FAILED", errorCode: errorCode || null } }),
  ]);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  const input = await request.json().catch(() => null) as { action?: string; studentId?: string; requestKey?: string; constraints?: unknown; exerciseName?: string } | null;
  if (!input?.studentId?.trim()) return Response.json({ error: "Seleccioná un alumno." }, { status: 400 });
  const student = await prisma.studentRecord.findUnique({ where: { id: input.studentId }, select: { id: true, serviceType: true, data: true } });
  if (!student) return Response.json({ error: "El alumno no existe." }, { status: 404 });
  if (student.serviceType === "CLASSES") return Response.json({ error: "La propuesta está disponible para alumnos Personalizados o Mixtos." }, { status: 403 });
  const exerciseCatalog = await catalog();
  if (input.action === "alternatives") return Response.json({ alternatives: exerciseAlternatives(input.exerciseName ?? "", exerciseCatalog) });
  const parsedConstraints = constraints(input.constraints); if (!parsedConstraints || !input.requestKey?.trim()) return Response.json({ error: "Las restricciones de la propuesta no son válidas." }, { status: 400 });
  const [physical, legacy] = await Promise.all([prisma.physicalEvaluation.findMany({ where: { studentId: student.id, status: { in: ["COMPLETED", "REASSESSMENT_RECOMMENDED"] } }, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }], take: 2 }), prisma.evaluationRecord.findMany({ select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } })]);
  const evaluations = deduplicateEvaluations([...physical.map(normalizePhysicalEvaluation), ...legacy.map(normalizeLegacyEvaluationRecord).filter((item) => item.studentId === student.id)]).slice(0, 2); const data = student.data && typeof student.data === "object" && !Array.isArray(student.data) ? student.data as Record<string, unknown> : {}; const context = buildRoutineAIContext({ id: student.id, serviceType: student.serviceType, goal: typeof data.goal === "string" ? data.goal : "", level: typeof data.level === "string" ? data.level : "" }, evaluations, argentinaDateKey());
  let reservation: Awaited<ReturnType<typeof reserve>> | null = null; const started = Date.now();
  try {
    reservation = await reserve(student.id, input.requestKey); const result = await generateRoutineAIProposal(context, parsedConstraints, exerciseCatalog); await finalize(reservation, true);
    await prisma.nutritionAIInteraction.create({ data: { studentId: student.id, feature: "routine_proposal", intention: "generate", contextSnapshot: Prisma.JsonNull, inputSummary: `${parsedConstraints.requestedDays} días · ${parsedConstraints.location}`, outputSummary: `${result.proposal.days.length} días · ${result.proposal.days.flatMap((day) => day.blocks).length} bloques`, provider: "external", modelVersion: result.model, usageMetadata: result.usage as Prisma.InputJsonValue | undefined, latencyMs: Date.now() - started, success: true } });
    return Response.json({ proposal: result.proposal, contextSummary: { hasEvaluation: Boolean(context.evaluation), validity: context.evaluation?.validity ?? "NO_EVALUATION", priorityCount: context.evaluation?.priorities.length ?? 0 } });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "AI_FAILED"; if (reservation) await finalize(reservation, false, code).catch(() => undefined); await prisma.nutritionAIInteraction.create({ data: { studentId: student.id, feature: "routine_proposal", intention: "generate", contextSnapshot: Prisma.JsonNull, inputSummary: `${parsedConstraints.requestedDays} días · ${parsedConstraints.location}`, outputSummary: "", provider: "external", latencyMs: Date.now() - started, success: false, errorCode: code } }).catch(() => undefined);
    if (code === "DAILY_LIMIT") return Response.json({ error: "Se alcanzó el límite diario de propuestas." }, { status: 429 }); if (code === "DUPLICATE_REQUEST") return Response.json({ error: "Esta solicitud ya está en proceso." }, { status: 409 }); console.error("Error al generar propuesta de rutina", code); return Response.json({ error: "No se pudo generar la propuesta. Podés continuar creando la rutina manualmente." }, { status: 502 });
  }
}
