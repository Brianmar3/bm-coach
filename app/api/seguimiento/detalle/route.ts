import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Student } from "@/types/gestion";
import type { AdminExerciseProgress, AdminFollowUpDetail, AdminWorkoutSession } from "@/types/follow-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const blockLabels: Record<string, string> = { STRENGTH: "Fuerza", ROUNDS: "Circuito", INTERVAL: "Intervalos", EMOM: "EMOM", AMRAP: "AMRAP", FOR_TIME: "Por tiempo", FREE: "Libre" };
const decimal = (value: Prisma.Decimal | null) => value === null ? null : Number(value);
function studentName(data: Prisma.JsonValue) { const value = data as unknown as Student; return `${value.firstName ?? ""} ${value.lastName ?? ""}`.trim() || "Alumno"; }

export async function GET(request: Request) {
  try {
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
    if (!studentId) return Response.json({ error: "Alumno requerido." }, { status: 400 });
    const [sessions, evaluations] = await Promise.all([
      prisma.workoutSession.findMany({
        where: { studentId }, include: { student: true, routine: true, day: true, blocks: true,
          exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } },
          comments: { where: { author: "STUDENT", status: "PENDING", parentId: null }, select: { id: true } } },
        orderBy: [{ date: "desc" }, { updatedAt: "desc" }], take: 100,
      }),
      prisma.physicalEvaluation.findMany({ where: { studentId }, select: { id: true, date: true, weight: true, bodyFatPercentage: true, muscleMass: true }, orderBy: { date: "asc" }, take: 24 }),
    ]);
    const exerciseIds = [...new Set(sessions.flatMap((session) => session.exercises.map((log) => log.exerciseReferenceId ?? log.exerciseId).filter((id): id is string => Boolean(id))))];
    const previousLogs = exerciseIds.length ? await prisma.workoutExerciseLog.findMany({
      where: { session: { studentId, status: "COMPLETED" }, OR: [{ exerciseReferenceId: { in: exerciseIds } }, { exerciseId: { in: exerciseIds } }] },
      include: { sets: true, session: { select: { id: true, studentId: true, date: true } } }, orderBy: { session: { date: "desc" } },
    }) : [];
    const serializedSessions: AdminWorkoutSession[] = sessions.map((session) => {
      const snapshot = session.exercises.find((log) => log.snapshotVersion !== null);
      return {
        id: session.id, studentId: session.studentId, studentName: studentName(session.student.data), routineId: session.routineId ?? "",
        routine: session.routineNameSnapshot ?? snapshot?.routineName ?? session.routine?.name ?? "Rutina eliminada",
        dayNumber: session.routineDayNumberSnapshot ?? snapshot?.routineDayNumber ?? session.day?.dayNumber ?? 0,
        date: session.date.toISOString().slice(0, 10), startTime: session.startTime, durationMinutes: session.durationMinutes,
        status: session.status.toLowerCase() as AdminWorkoutSession["status"], energyBefore: session.energyBefore, difficulty: session.difficulty,
        energyAfter: session.energyAfter, finalComment: session.finalComment, hasPain: session.hasPain, painDetails: session.painDetails,
        updatedAt: session.updatedAt.toISOString(), exerciseCount: session.exercises.length,
        completedSets: session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0), pendingComments: session.comments.length,
        exercises: [...session.exercises].sort((left, right) => (left.exerciseOrder ?? left.exercise?.order ?? 0) - (right.exerciseOrder ?? right.exercise?.order ?? 0)).map((log) => {
          const referenceId = log.exerciseReferenceId ?? log.exerciseId;
          const previous = previousLogs.find((candidate) => (candidate.exerciseReferenceId ?? candidate.exerciseId) === referenceId && candidate.session.id !== session.id && candidate.session.date < session.date);
          const bestPrevious = previous?.sets.filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? null;
          const hasSnapshot = log.snapshotVersion !== null;
          return {
            id: log.id, exerciseId: referenceId ?? log.id, name: hasSnapshot ? log.exerciseName ?? "Ejercicio eliminado" : log.exercise?.name ?? "Ejercicio eliminado",
            targetSets: hasSnapshot ? log.targetSets ?? 0 : log.exercise?.sets ?? 0, targetRepetitions: hasSnapshot ? log.targetRepetitions ?? "—" : log.exercise?.repetitions ?? "—",
            suggestedWeight: decimal(hasSnapshot ? log.suggestedWeight : log.exercise?.weight ?? null), effortType: hasSnapshot ? log.targetEffortType ?? "RIR" : log.exercise?.effortType ?? "RIR",
            targetEffort: decimal(hasSnapshot ? log.targetEffortValue : log.exercise?.effortValue ?? null), restSeconds: hasSnapshot ? log.targetRestSeconds : log.exercise?.restSeconds ?? null,
            coachInstructions: hasSnapshot ? log.coachInstructions ?? "" : log.exercise?.observations ?? "", legacySnapshot: log.snapshotVersion !== 1, studentObservation: log.observation,
            sets: log.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, weight: decimal(set.weight), repetitions: set.repetitions, effort: decimal(set.effort), completed: set.completed, observation: set.observation })),
            previous: previous && bestPrevious ? { date: previous.session.date.toISOString().slice(0, 10), weight: decimal(bestPrevious.weight), repetitions: bestPrevious.repetitions, effort: decimal(bestPrevious.effort) } : null,
          };
        }),
      };
    });
    const blocks = new Map<string, number>();
    for (const session of sessions.filter((item) => item.status === "COMPLETED")) for (const block of session.blocks.filter((item) => item.completed)) blocks.set(block.blockType, (blocks.get(block.blockType) ?? 0) + 1);
    const progress = new Map<string, AdminExerciseProgress>();
    for (const session of serializedSessions.filter((item) => item.status === "completed").slice().reverse()) for (const exercise of session.exercises) {
      const sets = exercise.sets.filter((set) => set.completed); if (!sets.length) continue;
      const item = progress.get(exercise.exerciseId) ?? { exerciseId: exercise.exerciseId, name: exercise.name, points: [] };
      const weights = sets.flatMap((set) => set.weight === null ? [] : [set.weight]); const efforts = sets.flatMap((set) => set.effort === null ? [] : [set.effort]);
      item.points.push({ date: session.date, weight: weights.length ? Math.max(...weights) : null, repetitions: sets.reduce((sum, set) => sum + (set.repetitions ?? 0), 0), completedSets: sets.length, effort: efforts.length ? Number((efforts.reduce((sum, value) => sum + value, 0) / efforts.length).toFixed(1)) : null });
      progress.set(exercise.exerciseId, item);
    }
    const detail: AdminFollowUpDetail = {
      studentId, sessions: serializedSessions,
      evaluations: evaluations.map((item) => ({ id: item.id, date: item.date.toISOString().slice(0, 10), weight: decimal(item.weight), bodyFatPercentage: decimal(item.bodyFatPercentage), muscleMass: decimal(item.muscleMass) })),
      blockDistribution: [...blocks.entries()].map(([type, count]) => ({ type, label: blockLabels[type] ?? type, count })).sort((left, right) => right.count - left.count),
      exerciseProgress: [...progress.values()],
    };
    return Response.json(detail);
  } catch (error) {
    console.error("Error al cargar el detalle de seguimiento", error);
    return Response.json({ error: "No se pudo cargar el detalle." }, { status: 500 });
  }
}
