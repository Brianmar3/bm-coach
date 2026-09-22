import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { isSelfService } from "@/lib/self-service";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canonicalPlanName, isPersistentPlanId, plansWithIds, removedAssignedPlan, synchronizedStudentPlan, validateCoachPlans, validatePaymentMethods } from "@/lib/coach-plans";
import type { CoachSettings, Student } from "@/types/gestion";
import { normalizeTransferDetails, validateTransferDetails } from "@/lib/transfer-payment";
import { normalizeAccentColor } from "@/lib/workspace-branding";
import { assertTrainerCanReplaceStudents, TrainerStudentLimitError } from "@/lib/trainer-plan-limits-server";

const collections = {
  "bm-coach-students": prisma.studentRecord,
  "bm-coach-payments": prisma.paymentRecord,
  "bm-coach-events": prisma.eventRecord,
  "bm-coach-settings": prisma.coachSettingsRecord,
};

type StoredRecord = { id: string; data: Prisma.JsonValue };
type StoreRepository = { findMany: (args: { orderBy: { updatedAt: "desc" } }) => Promise<StoredRecord[]> };

function getCollection(name: string): StoreRepository | undefined {
  return collections[name as keyof typeof collections] as unknown as StoreRepository | undefined;
}

export async function GET(_request: Request, context: RouteContext<"/api/store/[collection]">) {
  const { collection } = await context.params;
  const repository = getCollection(collection);
  if (!repository) return Response.json({ error: "Colección no disponible." }, { status: 404 });
  const { workspaceId } = await requireTrainerWorkspace();
  const records = collection === "bm-coach-students"
    ? await prisma.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere] }, orderBy: { updatedAt: "desc" } })
    : collection === "bm-coach-settings"
      ? await prisma.coachSettingsRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } })
      : collection === "bm-coach-payments"
        ? await prisma.paymentRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } })
        : await prisma.eventRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
  return Response.json(records.map((record) => ({ id: record.id, ...record.data as object })));
}

export async function PUT(request: Request, context: RouteContext<"/api/store/[collection]">) {
  const { collection } = await context.params;
  const repository = getCollection(collection);
  if (!repository) return Response.json({ error: "Colección no disponible." }, { status: 404 });
  const { workspaceId } = await requireTrainerWorkspace();
  const body = await request.json() as { items?: Array<{ id: string }> };
  if (!Array.isArray(body.items) || body.items.some((item) => !item.id)) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  if (collection === "bm-coach-settings") return saveCoachSettings(body.items);
  if (collection === "bm-coach-students") {
    const items = body.items;
    if (items.some(isSelfService)) return Response.json({ error: "Las cuentas autogestionadas se administran por separado." }, { status: 400 });
    try {
      const saved = await prisma.$transaction(async (transaction) => {
        const reserved = await transaction.studentRecord.count({ where: { workspaceId, id: { in: items.map((item) => item.id) }, data: { path: ["accountType"], equals: "SELF_SERVICE" } } });
        if (reserved) return false;
        await assertTrainerCanReplaceStudents(workspaceId, items.map((data) => ({ data })), transaction);
        await transaction.studentRecord.deleteMany({ where: { workspaceId, AND: [coachedStudentsWhere] } });
        if (items.length) await transaction.studentRecord.createMany({ data: items.map((item) => ({ workspaceId, id: item.id, data: item as Prisma.InputJsonValue })) });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return Response.json(saved ? { ok: true } : { error: "Una cuenta autogestionada no puede reemplazarse desde alumnos." }, { status: saved ? 200 : 409 });
    } catch (error) {
      if (error instanceof TrainerStudentLimitError) return Response.json({ error: error.message, code: "TRAINER_STUDENT_LIMIT_REACHED", action: "Ver planes" }, { status: error.status });
      throw error;
    }
  }
  if (collection === "bm-coach-payments") {
    await prisma.paymentRecord.deleteMany({ where: { workspaceId } });
    if (body.items.length) await prisma.paymentRecord.createMany({ data: body.items.map((item) => ({ workspaceId, id: item.id, data: item as Prisma.InputJsonValue })) });
  } else {
    await prisma.eventRecord.deleteMany({ where: { workspaceId } });
    if (body.items.length) await prisma.eventRecord.createMany({ data: body.items.map((item) => ({ workspaceId, id: item.id, data: item as Prisma.InputJsonValue })) });
  }
  return Response.json({ ok: true });
}

async function saveCoachSettings(items: Array<{ id: string }>) {
  if (items.length !== 1) return Response.json({ error: "La configuración principal no es válida." }, { status: 400 });
  const { workspaceId } = await requireTrainerWorkspace();
  const requested = items[0] as unknown as CoachSettings;
  if (!Array.isArray(requested.plans) || !Array.isArray(requested.paymentMethods)) {
    return Response.json({ error: "Los planes y métodos de pago no son válidos." }, { status: 400 });
  }
  const planError = validateCoachPlans(requested.plans);
  const methodError = validatePaymentMethods(requested.paymentMethods);
  const transferError = validateTransferDetails(requested.transferDetails);
  const accentColor = normalizeAccentColor(requested.accentColor);
  if (!accentColor) return Response.json({ error: "El color principal debe usar formato HEX, por ejemplo #3B82F6." }, { status: 400 });
  if (planError || methodError || transferError) return Response.json({ error: planError ?? methodError ?? transferError }, { status: 400 });

  const [currentRecord, studentRecords] = await Promise.all([
    prisma.coachSettingsRecord.findFirst({ where: { workspaceId: (await requireTrainerWorkspace()).workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, data: true } }),
    prisma.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere] }, select: { id: true, data: true } }),
  ]);
  const current = currentRecord?.data as unknown as CoachSettings | undefined;
  const requestedPersistentPlans = plansWithIds(requested.plans);
  const currentPlans = plansWithIds(current?.plans).map((plan, index) => {
    if (plan.id) return plan;
    const samePlan = requestedPersistentPlans.find((candidate) =>
      canonicalPlanName(candidate.name) === canonicalPlanName(plan.name)
      && Number(candidate.price) === Number(plan.price));
    return { ...plan, id: samePlan?.id || requestedPersistentPlans[index]?.id || "" };
  });
  const nextPlans = requested.plans.map((plan) => ({
    ...plan,
    id: isPersistentPlanId(plan.id) ? plan.id.trim() : randomUUID(),
    name: canonicalPlanName(plan.name),
  }));
  const assignedRemoval = removedAssignedPlan(
    studentRecords.map((record) => record.data as unknown as Student),
    currentPlans,
    nextPlans,
  );
  if (assignedRemoval) {
    return Response.json(
      { error: `No podés quitar “${assignedRemoval.plan.name}” porque está asignado a ${assignedRemoval.student.firstName || "un alumno"} ${assignedRemoval.student.lastName || ""}. Cambiá primero su plan.`.trim() },
      { status: 409 },
    );
  }

  const settings: CoachSettings = {
    ...requested,
    accentColor,
    plans: nextPlans,
    paymentMethods: requested.paymentMethods.map((method) => method.trim()),
    transferDetails: normalizeTransferDetails(requested.transferDetails),
  };
  const studentUpdates = studentRecords.flatMap((record) => {
    const student = record.data as unknown as Student;
    const updated = synchronizedStudentPlan(student, currentPlans, nextPlans);
    if (updated.planId === student.planId && updated.plan === student.plan && updated.monthlyFee === student.monthlyFee) return [];
    return [prisma.studentRecord.update({
      where: { id: record.id },
      data: { data: { ...(record.data as Prisma.JsonObject), planId: updated.planId ?? "", plan: updated.plan, monthlyFee: updated.monthlyFee } },
    })];
  });
  await prisma.$transaction([
    ...studentUpdates,
    prisma.coachSettingsRecord.deleteMany({ where: { workspaceId } }),
    prisma.coachSettingsRecord.create({ data: { id: currentRecord?.id ?? `settings-${workspaceId}`, workspaceId, data: settings as unknown as Prisma.InputJsonObject } }),
  ]);
  return Response.json({ ok: true, settings });
}
