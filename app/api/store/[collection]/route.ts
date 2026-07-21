import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const collections = {
  "bm-coach-students": prisma.studentRecord,
  "bm-coach-payments": prisma.paymentRecord,
  "bm-coach-events": prisma.eventRecord,
  "bm-coach-routines": prisma.routineRecord,
  "bm-coach-evaluations": prisma.evaluationRecord,
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
  await repository.deleteMany();
  if (body.items.length) await repository.createMany({ data: body.items.map((item) => ({ id: item.id, data: item as Prisma.InputJsonValue })) });
  return Response.json({ ok: true });
}
