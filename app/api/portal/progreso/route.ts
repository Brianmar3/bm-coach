import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { activePortalRoutineWhere } from "@/lib/portal-service-access";
import { hasPersonalizedService } from "@/lib/student-service";
import { buildPortalProgress } from "@/lib/portal-progress";
import { evaluationInclude, normalizeLegacyEvaluationRecord, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";
import { deduplicateEvaluations } from "@/lib/evaluation-read-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const numeric = (value: { toNumber(): number } | null) => value === null ? null : value.toNumber();

export async function GET() {
  try {
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    if (!hasPersonalizedService(session.credential.student.serviceType)) return Response.json({ error: "El seguimiento personalizado no está disponible para este servicio." }, { status: 403 });

    const studentId = session.studentId;
    const routine = await prisma.trainingRoutine.findFirst({
      where: activePortalRoutineWhere(studentId),
      include: {
        days: { where: { active: true, archivedAt: null }, select: { id: true } },
        assignments: { where: { studentId, active: true, archivedAt: null }, select: { assignedAt: true }, orderBy: { assignedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!routine || !routine.assignments[0]) return Response.json({ error: "No tenés una rutina personalizada activa." }, { status: 404 });

    const [sessions, physicalEvaluations, legacyEvaluationRecords] = await Promise.all([
      prisma.workoutSession.findMany({
        where: { studentId, routineId: routine.id, status: "COMPLETED" },
        select: {
          id: true, date: true, routineNameSnapshot: true, routineDayNumberSnapshot: true,
          routineDayNameSnapshot: true, durationMinutes: true,
          blocks: { select: { completed: true } },
          exercises: {
            select: {
              exerciseReferenceId: true, exerciseName: true,
              exercise: { select: { name: true } },
              sets: { select: { completed: true, weight: true, repetitions: true } },
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.physicalEvaluation.findMany({
        where: { studentId, status: { in: ["COMPLETED", "REASSESSMENT_RECOMMENDED"] } },
        include: evaluationInclude,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.evaluationRecord.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    const evaluations = deduplicateEvaluations([
      ...physicalEvaluations.map(normalizePhysicalEvaluation),
      ...legacyEvaluationRecords.map(normalizeLegacyEvaluationRecord).filter((evaluation) => evaluation.studentId === studentId),
    ]).filter((evaluation) => evaluation.studentId === studentId && evaluation.status !== "IN_PROGRESS");

    return Response.json(buildPortalProgress({
      plan: {
        id: routine.id,
        name: routine.name,
        assignedAt: routine.assignments[0].assignedAt.toISOString(),
        startDate: routine.startDate?.toISOString().slice(0, 10) ?? null,
        durationWeeks: routine.durationWeeks,
        plannedDays: routine.days.length,
      },
      sessions: sessions.map((workout) => ({
        id: workout.id,
        date: workout.date.toISOString().slice(0, 10),
        routineName: workout.routineNameSnapshot || routine.name,
        dayNumber: workout.routineDayNumberSnapshot,
        dayName: workout.routineDayNameSnapshot,
        durationMinutes: workout.durationMinutes,
        blocks: workout.blocks,
        exercises: workout.exercises.map((exercise) => ({
          exerciseReferenceId: exercise.exerciseReferenceId,
          exerciseName: exercise.exerciseName?.trim() || exercise.exercise?.name || "Ejercicio",
          sets: exercise.sets.map((set) => ({ completed: set.completed, weight: numeric(set.weight), repetitions: set.repetitions })),
        })),
      })),
      evaluations: evaluations.map((evaluation) => ({
        date: evaluation.date,
        weight: evaluation.weight,
        bodyFatPercentage: evaluation.bodyFatPercentage,
        muscleMass: evaluation.muscleMass,
        waist: evaluation.waist,
        hip: evaluation.hip,
        chest: evaluation.chest,
      })),
    }));
  } catch (error) {
    console.error("Error al cargar el progreso del portal", error);
    return Response.json({ error: "No pudimos cargar tu progreso." }, { status: 500 });
  }
}
