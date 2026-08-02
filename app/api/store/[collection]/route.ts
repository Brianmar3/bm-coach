import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { plansWithIds, removedAssignedPlan, synchronizedStudentPlan, validateCoachPlans, validatePaymentMethods } from "@/lib/coach-plans";
import type { CoachSettings, Student } from "@/types/gestion";

const collections = {
  "bm-coach-students": prisma.studentRecord,
  "bm-coach-payments": prisma.paymentRecord,
  "bm-coach-events": prisma.eventRecord,
  "bm-coach-settings": prisma.coachSettingsRecord,
};

type StoredRecord = { id: string; data: Prisma.JsonValue };
type StoreRepository = {
  findMany: (args: { orderBy: { updatedAt: "desc" } }) => Promise<StoredRecord[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: Array<{ id: string; data: Prisma.InputJsonValue }> }) => Promise<unknown>;
};

function getCollection(name: string): StoreRepository | undefined {
  return collections[name as keyof typeof collections] as unknown as StoreRepository | undefined;
}

export async function GET(_request: Request, context: RouteContext<"/api/store/[collection]">) {
  const { collection } = await context.params;
  const repository = getCollection(collection);
  if (!repository) return Response.json({ error: "Colección no disponible." }, { status: 404 });
  const records = await repository.findMany({ orderBy: { updatedAt: "desc" } });
  return Response.json(records.map((record) => ({ id: record.id, ...record.data as object })));
}

export async function PUT(request: Request, context: RouteContext<"/api/store/[collection]">) {
  const { collection } = await context.params;
  const repository = getCollection(collection);
  if (!repository) return Response.json({ error: "Colección no disponible." }, { status: 404 });
  const body = await request.json() as { items?: Array<{ id: string }> };
  if (!Array.isArray(body.items) || body.items.some((item) => !item.id)) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  if (collection === "bm-coach-settings") return saveCoachSettings(body.items);
  await repository.deleteMany();
  if (body.items.length) await repository.createMany({ data: body.items.map((item) => ({ id: item.id, data: item as Prisma.InputJsonValue })) });
  return Response.json({ ok: true });
}

async function saveCoachSettings(items: Array<{ id: string }>) {
  if (items.length !== 1) return Response.json({ error: "La configuración principal no es válida." }, { status: 400 });
  const requested = items[0] as unknown as CoachSettings;
  if (!Array.isArray(requested.plans) || !Array.isArray(requested.paymentMethods)) {
    return Response.json({ error: "Los planes y métodos de pago no son válidos." }, { status: 400 });
  }
  const planError = validateCoachPlans(requested.plans);
  const methodError = validatePaymentMethods(requested.paymentMethods);
  if (planError || methodError) return Response.json({ error: planError ?? methodError }, { status: 400 });

  const [currentRecord, studentRecords] = await Promise.all([
    prisma.coachSettingsRecord.findFirst({ orderBy: { updatedAt: "desc" }, select: { data: true } }),
    prisma.studentRecord.findMany({ select: { id: true, data: true } }),
  ]);
  const current = currentRecord?.data as unknown as CoachSettings | undefined;
  const currentPlans = plansWithIds(current?.plans);
  const nextPlans = plansWithIds(requested.plans).map((plan) => ({ ...plan, name: plan.name.trim() }));
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
    plans: nextPlans,
    paymentMethods: requested.paymentMethods.map((method) => method.trim()),
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
    prisma.coachSettingsRecord.deleteMany(),
    prisma.coachSettingsRecord.create({ data: { id: settings.id ?? "main", data: settings as unknown as Prisma.InputJsonObject } }),
  ]);
  return Response.json({ ok: true, settings });
}
