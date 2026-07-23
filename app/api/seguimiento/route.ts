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
    const exerciseIds = [...new Set(sessions.flatMap((session) => session.exercises.map((log) => log.exerciseId)))];
    const previousLogs = exerciseIds.length ? await prisma.workoutExerciseLog.findMany({
      where: { exerciseId: { in: exerciseIds }, session: { status: "COMPLETED" } },
      include: { sets: true, session: { select: { id: true, studentId: true, date: true } } },
      orderBy: { session: { date: "desc" } },
    }) : [];
    const trained = new Set(sessions.filter((item) => item.status === "COMPLETED").map((item) => item.studentId));
    return Response.json({
      sessions: sessions.map((session) => {
        const sessionSnapshot = session.exercises.find((log) => log.snapshotVersion === 1);
        return {
        id: session.id,
        studentId: session.studentId,
        studentName: name(session.student.data),
        routineId: session.routineId,
        routine: sessionSnapshot?.routineName ?? session.routine.name,
        dayNumber: sessionSnapshot?.routineDayNumber ?? session.day.dayNumber,
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
        exercises: [...session.exercises].sort((left, right) => (left.exerciseOrder ?? left.exercise.order) - (right.exerciseOrder ?? right.exercise.order)).map((log) => {
          const previous = previousLogs.find((candidate) => candidate.exerciseId === log.exerciseId && candidate.session.studentId === session.studentId && candidate.session.id !== session.id && candidate.session.date < session.date);
          const bestPrevious = previous?.sets.filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? null;
          const legacySnapshot = log.snapshotVersion !== 1;
          return {
            id: log.id,
            exerciseId: log.exerciseId,
            name: legacySnapshot ? log.exercise.name : log.exerciseName!,
            targetSets: legacySnapshot ? log.exercise.sets : log.targetSets!,
            targetRepetitions: legacySnapshot ? log.exercise.repetitions : log.targetRepetitions!,
            suggestedWeight: decimal(legacySnapshot ? log.exercise.weight : log.suggestedWeight),
            effortType: legacySnapshot ? log.exercise.effortType : log.targetEffortType!,
            targetEffort: decimal(legacySnapshot ? log.exercise.effortValue : log.targetEffortValue),
            restSeconds: legacySnapshot ? log.exercise.restSeconds : log.targetRestSeconds,
            coachInstructions: legacySnapshot ? log.exercise.observations : log.coachInstructions!,
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
