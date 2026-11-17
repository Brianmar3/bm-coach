import { Prisma } from "@prisma/client";
import { addDateKeyDays, ensureClassOccurrences, occurrenceHasEnded } from "@/lib/class-occurrences";
import { classNoteSnapshot } from "@/lib/group-class-planning";
import { dateKeyToDatabase, databaseDateKey, isDateKey } from "@/lib/payment-dates";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const start = new URL(request.url).searchParams.get("start");
    if (!start || !isDateKey(start)) return Response.json({ error: "Fecha inválida." }, { status: 400 });
    await ensureClassOccurrences(35, workspaceId);
    const rows = await prisma.classOccurrence.findMany({
      where: { workspaceId, suppressedBySchedule: false, date: { gte: dateKeyToDatabase(start), lte: dateKeyToDatabase(addDateKeyDays(start, 6)) } },
      select: { id: true, date: true, startTime: true, endTime: true, classNameSnapshot: true, status: true, plannedRoutineId: true, plannedSnapshot: true, taughtSnapshot: true, taughtAt: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    return Response.json(rows.map((row) => ({ ...row, date: databaseDateKey(row.date) })));
  } catch {
    return Response.json({ error: "No se pudo cargar la planificación." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const input = await request.json() as { occurrenceId?: string; routineId?: string | null; action?: string; confirmed?: boolean };
    if (!input.occurrenceId || !["assign", "taught"].includes(input.action ?? "")) return Response.json({ error: "Acción inválida." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const occurrence = await tx.classOccurrence.findFirst({ where: { id: input.occurrenceId, workspaceId, suppressedBySchedule: false } });
      if (!occurrence) return { status: 404, error: "Clase no encontrada." };
      if (occurrence.status === "CANCELLED") return { status: 409, error: "Una clase cancelada no puede planificarse ni marcarse como dictada." };
      if (input.action === "assign") {
        if (occurrence.taughtAt) return { status: 409, error: "Una clase ya dictada conserva su planificación histórica." };
        if (input.routineId !== null && !input.routineId) return { status: 400, error: "Seleccioná una clase de la biblioteca." };
        const routine = input.routineId ? await tx.trainingRoutine.findFirst({
          where: { id: input.routineId, workspaceId, scope: "WORKSPACE", kind: "TEMPLATE", archivedAt: null },
          include: { days: { where: { active: true }, include: { blocks: { where: { active: true }, include: { exercises: { where: { active: true }, orderBy: { order: "asc" } } } } }, orderBy: { dayNumber: "asc" }, take: 1 } },
        }) : null;
        if (input.routineId && !routine) return { status: 404, error: "Clase guardada no encontrada en este espacio." };
        const snapshot = routine ? classNoteSnapshot(routine) as unknown as Prisma.InputJsonValue : null;
        await tx.classOccurrence.update({ where: { id: occurrence.id }, data: { plannedRoutineId: routine?.id ?? null, plannedSnapshot: snapshot ?? Prisma.DbNull } });
        if (routine && snapshot) await tx.groupClassPlan.upsert({
          where: { occurrenceId: occurrence.id },
          create: { workspaceId, date: occurrence.date, routineId: routine.id, occurrenceId: occurrence.id, snapshot },
          update: { routineId: routine.id, snapshot },
        });
        else await tx.groupClassPlan.deleteMany({ where: { workspaceId, occurrenceId: occurrence.id } });
        return { status: 200, message: routine ? "Clase asignada a la fecha." : "Planificación quitada de esta fecha." };
      }
      if (!input.confirmed) return { status: 400, error: "Confirmá que esta clase se dictó realmente." };
      if (!occurrence.plannedSnapshot) return { status: 409, error: "Asigná primero una planificación." };
      if (!occurrenceHasEnded(occurrence.date, occurrence.endTime)) return { status: 409, error: "Todavía no terminó el horario de esta clase." };
      if (occurrence.taughtAt) return { status: 200, message: "Esta clase ya figura como dictada." };
      await tx.classOccurrence.update({ where: { id: occurrence.id }, data: { taughtAt: new Date(), taughtSnapshot: occurrence.plannedSnapshot as Prisma.InputJsonValue, status: "COMPLETED" } });
      return { status: 200, message: "Clase registrada como dictada." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json("error" in result ? { error: result.error } : { message: result.message }, { status: result.status });
  } catch {
    return Response.json({ error: "No se pudo guardar la planificación." }, { status: 500 });
  }
}
