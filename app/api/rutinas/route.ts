import { createRoutineDays, databaseUnavailable, routineData, routineFingerprint, routineInclude, routineVersionSnapshot, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isActivePainReport } from "@/lib/routine-follow-up-filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const studentId = params.get("studentId")?.trim();
    const objective = params.get("objective")?.trim();
    const query = params.get("q")?.trim();
    const status = params.get("status")?.trim();
    const kind = params.get("kind")?.trim();
    const records = await prisma.trainingRoutine.findMany({
      where: {
        ...(studentId ? { assignments: { some: { studentId } } } : {}),
        ...(objective ? { objective } : {}),
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { objective: { contains: query, mode: "insensitive" } }] } : {}),
        ...(status === "ACTIVA" || status === "ARCHIVADA" ? { status } : {}),
        ...(kind === "ASSIGNED" || kind === "TEMPLATE" ? { kind } : {}),
      },
      include: routineInclude,
      orderBy: { createdAt: "desc" },
    });
    const routineIds = records.map((record) => record.id);
    const sessions = routineIds.length ? await prisma.workoutSession.findMany({
      where: { routineId: { in: routineIds }, status: "COMPLETED" },
      select: { routineId: true, date: true, durationMinutes: true, hasPain: true, painDetails: true },
      orderBy: { date: "asc" },
    }) : [];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const sessionsByRoutine = new Map<string, typeof sessions>();
    for (const session of sessions) {
      if (!session.routineId) continue;
      const related = sessionsByRoutine.get(session.routineId) ?? [];
      related.push(session);
      sessionsByRoutine.set(session.routineId, related);
    }
    const summaries = new Map(routineIds.map((routineId) => {
      const related = sessionsByRoutine.get(routineId) ?? [];
      const durations = related.flatMap((session) => session.durationMinutes === null ? [] : [session.durationMinutes]);
      const pain = [...related].reverse().find((session) => session.hasPain);
      const recentWeeklySessions = [3, 2, 1, 0].map((weeksAgo) => {
        const start = new Date(weekStart);
        start.setUTCDate(start.getUTCDate() - weeksAgo * 7);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        return related.filter((session) => session.date >= start && session.date < end).length;
      });
      return [routineId, {
        completedSessions: related.length,
        latestSessionDate: related.at(-1)?.date.toISOString() ?? "",
        averageDurationMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        recentWeeklySessions,
        latestPainReport: pain && isActivePainReport(pain.date, now) ? { date: pain.date.toISOString(), details: pain.painDetails } : null,
        progressPercentage: null,
      }] as const;
    }));
    return Response.json(records.map((record) => ({ ...serializeRoutine(record), managementSummary: summaries.get(record.id) })));
  } catch (error) {
    console.error("Error al consultar rutinas", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar las rutinas desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as RoutineInput;
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const students = input.kind === "template" ? 0 : await prisma.studentRecord.count({ where: { id: { in: input.studentIds } } });
    if (input.kind === "assigned" && students !== input.studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      const archivedAt = input.status === "archivada" ? new Date() : null;
      if (input.kind === "assigned" && input.status === "activa") {
        const conflicts = await transaction.trainingRoutineAssignment.count({ where: { studentId: { in: input.studentIds }, active: true, routine: { status: "ACTIVA" } } });
        if (conflicts) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
      }
      const created = await transaction.trainingRoutine.create({
        data: {
          ...routineData(input),
          archivedAt,
          assignments: input.kind === "assigned" ? { create: input.studentIds.map((studentId) => ({ studentId, active: input.status !== "archivada" && input.status !== "finalizada", archivedAt })) } : undefined,
        },
      });
      await createRoutineDays(transaction, created.id, input.days);
      const snapshot = routineVersionSnapshot(input);
      await transaction.trainingRoutineVersion.create({ data: { routineId: created.id, version: 1, summary: "Versión inicial", fingerprint: routineFingerprint(input), snapshot: snapshot as unknown as Prisma.InputJsonValue } });
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id: created.id }, include: routineInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json(serializeRoutine(record), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Uno o más alumnos ya tienen una rutina activa asignada." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Las asignaciones cambiaron al mismo tiempo. Recargá e intentá nuevamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al crear rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al crear rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar la rutina en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
