import { Prisma } from "@prisma/client";
import { addDateKeyDays, ensureClassOccurrences } from "@/lib/class-occurrences";
import { classNoteSnapshot, type ClassNote } from "@/lib/group-class-planning";
import { dateKeyToDatabase, databaseDateKey, isDateKey } from "@/lib/payment-dates";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { routineInclude } from "@/lib/rutinas";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validNote(value: unknown): value is ClassNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<ClassNote>;
  return typeof note.name === "string" && note.name.length <= 120 && typeof note.modality === "string" && note.modality.length <= 65
    && Array.isArray(note.blocks) && note.blocks.length <= 30
    && note.blocks.every((block) => typeof block?.name === "string" && block.name.length <= 120 && typeof block.text === "string" && block.text.length <= 36000);
}

const occurrenceSelect = { id: true, date: true, startTime: true, endTime: true, classNameSnapshot: true, status: true, taughtAt: true, taughtSnapshot: true, suppressedBySchedule: true } as const;

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const start = new URL(request.url).searchParams.get("start");
    if (!start || !isDateKey(start)) return Response.json({ error: "Fecha inválida." }, { status: 400 });
    await ensureClassOccurrences(35, workspaceId);
    const date = { gte: dateKeyToDatabase(start), lte: dateKeyToDatabase(addDateKeyDays(start, 6)) };
    const [plans, occurrences, recent] = await Promise.all([
      prisma.groupClassPlan.findMany({ where: { workspaceId, date }, include: { occurrence: { select: occurrenceSelect } }, orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.classOccurrence.findMany({ where: { workspaceId, date, suppressedBySchedule: false }, select: occurrenceSelect, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
      prisma.groupClassPlan.findMany({ where: { workspaceId, date: { lt: dateKeyToDatabase(start) } }, select: { id: true, date: true, snapshot: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }),
    ]);
    return Response.json({
      plans: plans.map((plan) => ({ ...plan, date: databaseDateKey(plan.date), occurrence: plan.occurrence ? { ...plan.occurrence, date: databaseDateKey(plan.occurrence.date) } : null })),
      occurrences: occurrences.map((occurrence) => ({ ...occurrence, date: databaseDateKey(occurrence.date) })),
      recent: recent.map((plan) => ({ ...plan, date: databaseDateKey(plan.date) })),
    });
  } catch {
    return Response.json({ error: "No se pudo cargar la planificación." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const input = await request.json() as { date?: string; routineId?: string; sourcePlanId?: string; snapshot?: unknown };
    if (!input.date || !isDateKey(input.date)) return Response.json({ error: "Fecha inválida." }, { status: 400 });
    const sources = Number(Boolean(input.routineId)) + Number(Boolean(input.sourcePlanId)) + Number(Boolean(input.snapshot));
    if (sources !== 1) return Response.json({ error: "Seleccioná una sola clase para planificar." }, { status: 400 });
    let snapshot: ClassNote;
    let routineId: string | null = null;
    if (input.routineId) {
      const routine = await prisma.trainingRoutine.findFirst({ where: { id: input.routineId, workspaceId, scope: "WORKSPACE", kind: "TEMPLATE", archivedAt: null }, include: routineInclude });
      if (!routine) return Response.json({ error: "Clase no encontrada en tu biblioteca." }, { status: 404 });
      snapshot = classNoteSnapshot(routine);
      routineId = routine.id;
    } else if (input.sourcePlanId) {
      const source = await prisma.groupClassPlan.findFirst({ where: { id: input.sourcePlanId, workspaceId } });
      if (!source || !validNote(source.snapshot)) return Response.json({ error: "Planificación anterior no encontrada." }, { status: 404 });
      snapshot = source.snapshot;
      routineId = source.routineId;
    } else if (validNote(input.snapshot)) {
      snapshot = input.snapshot;
    } else return Response.json({ error: "Contenido de clase inválido." }, { status: 400 });
    const last = await prisma.groupClassPlan.aggregate({ where: { workspaceId, date: dateKeyToDatabase(input.date) }, _max: { sortOrder: true } });
    const plan = await prisma.groupClassPlan.create({ data: { workspaceId, date: dateKeyToDatabase(input.date), sortOrder: (last._max.sortOrder ?? -1) + 1, routineId, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
    return Response.json({ id: plan.id }, { status: 201 });
  } catch {
    return Response.json({ error: "No se pudo guardar la clase." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const input = await request.json() as { id?: string; date?: string; snapshot?: unknown; occurrenceId?: string | null; orderedIds?: string[] };
    if (input.orderedIds !== undefined) {
      if (!input.date || !isDateKey(input.date) || !Array.isArray(input.orderedIds) || input.orderedIds.length > 100 || !input.orderedIds.every((id) => typeof id === "string") || new Set(input.orderedIds).size !== input.orderedIds.length) return Response.json({ error: "Orden inválido." }, { status: 400 });
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.groupClassPlan.findMany({ where: { workspaceId, date: dateKeyToDatabase(input.date!) }, select: { id: true } });
        if (existing.length !== input.orderedIds!.length || existing.some((plan) => !input.orderedIds!.includes(plan.id))) return false;
        for (const [sortOrder, id] of input.orderedIds!.entries()) await tx.groupClassPlan.update({ where: { id, workspaceId }, data: { sortOrder } });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return Response.json(result ? { message: "Orden guardado." } : { error: "La planificación cambió. Actualizá e intentá de nuevo." }, { status: result ? 200 : 409 });
    }
    if (!input.id || (input.date !== undefined && !isDateKey(input.date)) || (input.snapshot !== undefined && !validNote(input.snapshot))) return Response.json({ error: "Cambios inválidos." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.groupClassPlan.findFirst({ where: { id: input.id, workspaceId }, include: { occurrence: true } });
      if (!plan) return { status: 404, error: "Planificación no encontrada." };
      if (plan.occurrence?.taughtAt) return { status: 409, error: "Una clase dictada conserva su historial." };
      const date = input.date ? dateKeyToDatabase(input.date) : plan.date;
      const nextOccurrenceId = input.occurrenceId !== undefined ? input.occurrenceId : input.date && input.date !== databaseDateKey(plan.date) ? null : plan.occurrenceId;
      if (nextOccurrenceId) {
        const occurrence = await tx.classOccurrence.findFirst({ where: { id: nextOccurrenceId, workspaceId, date, suppressedBySchedule: false, status: { not: "CANCELLED" }, taughtAt: null } });
        if (!occurrence) return { status: 400, error: "El horario elegido no corresponde a esa fecha." };
        const other = await tx.groupClassPlan.findFirst({ where: { occurrenceId: nextOccurrenceId, id: { not: plan.id } } });
        if (other || (occurrence.plannedSnapshot && plan.occurrenceId !== nextOccurrenceId)) return { status: 409, error: "Ese horario ya tiene una planificación." };
      }
      if (plan.occurrenceId && plan.occurrenceId !== nextOccurrenceId) await tx.classOccurrence.update({ where: { id: plan.occurrenceId }, data: { plannedRoutineId: null, plannedSnapshot: Prisma.DbNull } });
      const snapshot = input.snapshot !== undefined ? input.snapshot as ClassNote : plan.snapshot as unknown as ClassNote;
      const destinationOrder = input.date && input.date !== databaseDateKey(plan.date)
        ? ((await tx.groupClassPlan.aggregate({ where: { workspaceId, date }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1
        : plan.sortOrder;
      await tx.groupClassPlan.update({ where: { id: plan.id }, data: { date, sortOrder: destinationOrder, occurrenceId: nextOccurrenceId, snapshot: snapshot as unknown as Prisma.InputJsonValue, routineId: input.snapshot !== undefined ? null : plan.routineId } });
      if (nextOccurrenceId) await tx.classOccurrence.update({ where: { id: nextOccurrenceId }, data: { plannedRoutineId: input.snapshot !== undefined ? null : plan.routineId, plannedSnapshot: snapshot as unknown as Prisma.InputJsonValue } });
      return { status: 200, message: "Planificación actualizada." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json("error" in result ? { error: result.error } : { message: result.message }, { status: result.status });
  } catch {
    return Response.json({ error: "No se pudo actualizar la planificación." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const input = await request.json() as { id?: string };
    if (!input.id) return Response.json({ error: "Planificación inválida." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.groupClassPlan.findFirst({ where: { id: input.id, workspaceId }, include: { occurrence: true } });
      if (!plan) return { status: 404, error: "Planificación no encontrada." };
      if (plan.occurrence?.taughtAt) return { status: 409, error: "Una clase dictada no puede eliminarse del historial." };
      if (plan.occurrenceId) await tx.classOccurrence.update({ where: { id: plan.occurrenceId }, data: { plannedRoutineId: null, plannedSnapshot: Prisma.DbNull } });
      await tx.groupClassPlan.delete({ where: { id: plan.id } });
      return { status: 200, message: "Planificación eliminada." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json("error" in result ? { error: result.error } : { message: result.message }, { status: result.status });
  } catch {
    return Response.json({ error: "No se pudo eliminar la planificación." }, { status: 500 });
  }
}
