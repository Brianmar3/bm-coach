import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function name(data: Prisma.JsonValue) {
  const value = data as unknown as Student;
  return `${value.firstName ?? ""} ${value.lastName ?? ""}`.trim() || "Alumno";
}
function decimal(value: Prisma.Decimal | null) { return value === null ? null : Number(value); }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const routineId = params.get("routineId") || undefined;
    const studentId = params.get("studentId") || undefined;
    const [sessions, students, routines] = await Promise.all([
      prisma.workoutSession.findMany({
        where: { ...(routineId ? { routineId } : {}), ...(studentId ? { studentId } : {}) },
        include: {
          student: true,
          routine: true,
          day: true,
          exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } }, orderBy: { exercise: { order: "asc" } } },
          comments: { where: { author: "STUDENT", status: "PENDING", parentId: null }, select: { id: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
      }),
      prisma.studentRecord.findMany({ select: { id: true, data: true } }),
      prisma.trainingRoutine.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const exerciseIds = [...new Set(sessions.flatMap((session) => session.exercises.map((log) => log.exerciseReferenceId ?? log.exerciseId).filter((id): id is string => Boolean(id))))];
    const previousLogs = exerciseIds.length ? await prisma.workoutExerciseLog.findMany({
      where: { OR: [{ exerciseReferenceId: { in: exerciseIds } }, { exerciseId: { in: exerciseIds } }], session: { status: "COMPLETED" } },
      include: { sets: true, session: { select: { id: true, studentId: true, date: true } } },
      orderBy: { session: { date: "desc" } },
    }) : [];
    const trained = new Set(sessions.filter((item) => item.status === "COMPLETED").map((item) => item.studentId));
    return Response.json({
      sessions: sessions.map((session) => {
        const sessionSnapshot = session.exercises.find((log) => log.snapshotVersion !== null);
        return {
        id: session.id,
        studentId: session.studentId,
        studentName: name(session.student.data),
        routineId: session.routineId ?? "",
        routine: session.routineNameSnapshot ?? sessionSnapshot?.routineName ?? session.routine?.name ?? "Rutina eliminada",
        dayNumber: session.routineDayNumberSnapshot ?? sessionSnapshot?.routineDayNumber ?? session.day?.dayNumber ?? 0,
        date: session.date.toISOString().slice(0, 10),
        startTime: session.startTime,
        durationMinutes: session.durationMinutes,
        status: session.status.toLowerCase(),
        energyBefore: session.energyBefore,
        difficulty: session.difficulty,
        energyAfter: session.energyAfter,
        finalComment: session.finalComment,
        hasPain: session.hasPain,
        painDetails: session.painDetails,
        updatedAt: session.updatedAt.toISOString(),
        exerciseCount: session.exercises.length,
        completedSets: session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0),
        pendingComments: session.comments.length,
        exercises: [...session.exercises].sort((left, right) => (left.exerciseOrder ?? left.exercise?.order ?? 0) - (right.exerciseOrder ?? right.exercise?.order ?? 0)).map((log) => {
          const referenceId = log.exerciseReferenceId ?? log.exerciseId;
          const previous = previousLogs.find((candidate) => (candidate.exerciseReferenceId ?? candidate.exerciseId) === referenceId && candidate.session.studentId === session.studentId && candidate.session.id !== session.id && candidate.session.date < session.date);
          const bestPrevious = previous?.sets.filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? null;
          const legacySnapshot = log.snapshotVersion !== 1;
          const hasSnapshot = log.snapshotVersion !== null;
          return {
            id: log.id,
            exerciseId: referenceId ?? log.id,
            name: hasSnapshot ? log.exerciseName ?? "Ejercicio eliminado" : log.exercise?.name ?? "Ejercicio eliminado",
            targetSets: hasSnapshot ? log.targetSets ?? 0 : log.exercise?.sets ?? 0,
            targetRepetitions: hasSnapshot ? log.targetRepetitions ?? "—" : log.exercise?.repetitions ?? "—",
            suggestedWeight: decimal(hasSnapshot ? log.suggestedWeight : log.exercise?.weight ?? null),
            effortType: hasSnapshot ? log.targetEffortType ?? "RIR" : log.exercise?.effortType ?? "RIR",
            targetEffort: decimal(hasSnapshot ? log.targetEffortValue : log.exercise?.effortValue ?? null),
            restSeconds: hasSnapshot ? log.targetRestSeconds : log.exercise?.restSeconds ?? null,
            coachInstructions: hasSnapshot ? log.coachInstructions ?? "" : log.exercise?.observations ?? "",
            legacySnapshot,
            studentObservation: log.observation,
            sets: log.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, weight: decimal(set.weight), repetitions: set.repetitions, effort: decimal(set.effort), completed: set.completed, observation: set.observation })),
            previous: previous && bestPrevious ? { date: previous.session.date.toISOString().slice(0, 10), weight: decimal(bestPrevious.weight), repetitions: bestPrevious.repetitions, effort: decimal(bestPrevious.effort) } : null,
          };
        }),
        };
      }),
      routines,
      studentsWithoutTraining: students.filter((item) => (item.data as unknown as Student).status !== "inactivo" && !trained.has(item.id)).map((item) => ({ id: item.id, name: name(item.data) })).slice(0, 20),
    });
  } catch (error) {
    console.error("Error al cargar seguimiento", error);
    return Response.json({ error: "No se pudo cargar el seguimiento." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const input = await request.json() as { sessionId?: string; body?: string; private?: boolean; reviewed?: boolean };
    const session = input.sessionId ? await prisma.workoutSession.findUnique({ where: { id: input.sessionId }, select: { id: true, studentId: true } }) : null;
    if (!session) return Response.json({ error: "Sesión no encontrada." }, { status: 404 });
    const body = input.body?.trim() ?? "";
    if (body.length > 2000) return Response.json({ error: "La devolución no puede superar 2000 caracteres." }, { status: 400 });
    await prisma.$transaction(async (transaction) => {
      if (body) await transaction.followUpComment.create({ data: { studentId: session.studentId, author: "COACH", context: "SESSION", category: "FEEDBACK", status: "REVIEWED", body, private: Boolean(input.private), sessionId: session.id } });
      if (input.reviewed) await transaction.followUpComment.updateMany({ where: { sessionId: session.id, author: "STUDENT", status: "PENDING" }, data: { status: "REVIEWED" } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error al responder seguimiento", error);
    return Response.json({ error: "No se pudo actualizar el seguimiento." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const input = await request.json().catch(() => null) as { sessionId?: string; studentId?: string; routineId?: string; deleteAll?: boolean } | null;
    if (input?.deleteAll) {
      if (!input.studentId?.trim() || !input.routineId?.trim()) return Response.json({ error: "Alumno y rutina son obligatorios." }, { status: 400 });
      const result = await prisma.$transaction(async (transaction) => {
        const where = { studentId: input.studentId!, routineId: input.routineId! };
        const count = await transaction.workoutSession.count({ where });
        if (!count) return 0;
        const deleted = await transaction.workoutSession.deleteMany({ where });
        return deleted.count;
      });
      return Response.json({ message: `${result} registros de entrenamiento eliminados definitivamente.`, deleted: result });
    }
    if (!input?.sessionId?.trim()) return Response.json({ error: "El registro seleccionado no es válido." }, { status: 400 });
    const deleted = await prisma.workoutSession.deleteMany({ where: { id: input.sessionId } });
    if (!deleted.count) return Response.json({ error: "Registro de entrenamiento no encontrado." }, { status: 404 });
    return Response.json({ message: "Registro de entrenamiento eliminado correctamente.", deleted: 1 });
  } catch (error) {
    console.error("Error al eliminar seguimiento", error);
    return Response.json({ error: "No se pudo eliminar el registro de entrenamiento." }, { status: 500 });
  }
}
