import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import type { PortalWorkoutSession } from "@/types/portal";
import { loadStrengthAchievements } from "@/lib/strength-achievements";
import { bmTrainingActivityStart } from "@/lib/bm-training";
import type { Student } from "@/types/gestion";
import { achievementCelebrationPayload, notifyNewAchievements } from "@/lib/push-notifications";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";
import { validateWorkoutSessionInput } from "@/lib/workout-session-validation";
import { getWeekKey, getWorkoutWeekRange, weeklySessionLockKey } from "@/lib/workout-week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workoutSessionSelect = {
  id: true,
  routineId: true,
  dayId: true,
  date: true,
  routineNameSnapshot: true,
  routineDayNumberSnapshot: true,
  routineDayNameSnapshot: true,
  routineDayEstimatedMinutesSnapshot: true,
  status: true,
  exercises: {
    select: {
      exerciseId: true,
      exerciseReferenceId: true,
      snapshotVersion: true,
      exerciseName: true,
      targetSets: true,
      targetRepetitions: true,
      suggestedWeight: true,
      targetEffortType: true,
      targetEffortValue: true,
      targetRestSeconds: true,
      coachInstructions: true,
      exerciseOrder: true,
      routineName: true,
      routineDayNumber: true,
    },
  },
  blocks: {
    select: { blockId: true, blockReferenceId: true, snapshotVersion: true, blockName: true, blockType: true, blockOrder: true, blockConfiguration: true, exercisesSnapshot: true },
  },
} satisfies Prisma.WorkoutSessionSelect;

export async function POST(request: Request) {
  let parsedInput: PortalWorkoutSession | null = null;
  let saveStage = "request";
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal." }, { status: 403 });
    const raw = await request.json() as PortalWorkoutSession;
    parsedInput = raw;
    // Normalizar payload para evitar errores por campos undefined en bloques nuevos (defensiva).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const input: PortalWorkoutSession = {
      ...raw,
      blocks: (raw.blocks ?? []).map((b) => ({
        blockId: (b as any).blockId,
        blockName: String((b as any).blockName ?? ""),
        blockType: (b as any).blockType ?? "FREE",
        blockOrder: (b as any).blockOrder ?? 0,
        configuration: (b as any).configuration ?? {},
        exercises: Array.isArray((b as any).exercises) ? (b as any).exercises.map((e: any) => ({ exerciseId: String(e.exerciseId ?? ""), name: String(e.name ?? ""), targetType: String(e.targetType ?? ""), targetLabel: String(e.targetLabel ?? ""), order: Number(e.order ?? 0) })) : [],
        result: (() => {
          const r: any = (b as any).result ?? {};
          return {
            completed: Boolean(r.completed),
            roundsCompleted: Number.isInteger(r.roundsCompleted) ? r.roundsCompleted : null,
            minutesCompleted: Number.isInteger(r.minutesCompleted) ? r.minutesCompleted : null,
            extraRepetitions: Number.isInteger(r.extraRepetitions) ? r.extraRepetitions : null,
            durationSeconds: Number.isInteger(r.durationSeconds) ? r.durationSeconds : null,
            pendingWork: String(r.pendingWork ?? ""),
            resultText: String(r.resultText ?? ""),
            observation: String(r.observation ?? ""),
            completedExerciseIds: Array.isArray(r.completedExerciseIds) ? r.completedExerciseIds.map(String) : [],
          };
        })(),
      })),
      exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const validationError = validateWorkoutSessionInput(input);
    if (validationError) {
      if (process.env.NODE_ENV === "development") console.error("Payload de entrenamiento rechazado", { status: 400, validationError, routineId: input.routineId, dayId: input.dayId, sessionId: input.id ?? null, blocks: input.blocks, payload: input });
      return Response.json({ error: validationError, ...(process.env.NODE_ENV === "development" ? { invalidField: validationError } : {}) }, { status: 400 });
    }
    const weekRange = getWorkoutWeekRange(input.date);
    if (weekRange.weekKey !== getWeekKey()) return Response.json({ error: "Esta sesión pertenece a una semana anterior y quedó preservada en el historial." }, { status: 409 });

    let existingSession = input.id
      ? await prisma.workoutSession.findFirst({
        where: { id: input.id, studentId: session.studentId },
        select: workoutSessionSelect,
      })
      : null;
    if (!input.id) {
      existingSession = await prisma.workoutSession.findFirst({
        where: { studentId: session.studentId, routineId: input.routineId, dayId: input.dayId, status: "IN_PROGRESS", date: { gte: weekRange.startDate, lt: weekRange.endExclusiveDate } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: workoutSessionSelect,
      }) ?? await prisma.workoutSession.findFirst({
        where: { studentId: session.studentId, routineId: input.routineId, dayId: input.dayId, status: "COMPLETED", date: { gte: weekRange.startDate, lt: weekRange.endExclusiveDate } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: workoutSessionSelect,
      });
    }
    if (input.id && !existingSession) {
      return Response.json({ error: "El entrenamiento ya no existe o no te pertenece." }, { status: 404 });
    }
    if (existingSession?.status === "COMPLETED") {
      if (!input.id && input.status === "finalizado") return Response.json({ id: existingSession.id, status: "finalizado", reused: true });
      return Response.json({ error: "Una sesión finalizada no puede modificarse ni reabrirse." }, { status: 409 });
    }
    if (existingSession && (existingSession.routineId !== input.routineId || existingSession.dayId !== input.dayId)) {
      return Response.json({ error: "No se puede cambiar la rutina o el día de una sesión existente." }, { status: 400 });
    }
    if (input.id && existingSession && databaseDateKey(existingSession.date) !== input.date) {
      return Response.json({ error: "No se puede cambiar la fecha de una sesión existente." }, { status: 400 });
    }
    const resolvedSessionId = existingSession?.id ?? null;

    const assignment = await prisma.trainingRoutineAssignment.findUnique({
      where: { routineId_studentId: { routineId: input.routineId, studentId: session.studentId } },
      include: { routine: { include: { days: { include: { exercises: true, blocks: { include: { exercises: true } } } } } } },
    });
    const day = assignment?.routine.days.find((item) => item.id === input.dayId);
    if (!assignment || !day) return Response.json({ error: "La rutina o el día ya no están asignados a tu perfil." }, { status: 403 });
    const canStartSession =
      assignment.active &&
      assignment.archivedAt === null &&
      assignment.routine.kind === "ASSIGNED" &&
      assignment.routine.status === "ACTIVA" &&
      assignment.routine.archivedAt === null &&
      day.active &&
      day.archivedAt === null &&
      day.blocks.some((block) => block.active && block.archivedAt === null);
    if (!existingSession && !canStartSession) {
      return Response.json({ error: "Esta rutina está archivada o ya no se encuentra activa en tu perfil." }, { status: 403 });
    }
    const validExerciseIds = new Set(day.exercises.filter((exercise) => existingSession || exercise.active).map((exercise) => exercise.id));
    if (input.exercises.some((exercise) => !validExerciseIds.has(exercise.exerciseId))) return Response.json({ error: "Uno de los ejercicios no pertenece a tu rutina." }, { status: 403 });
    const validBlockIds = new Set(day.blocks.filter((block) => existingSession || block.active).map((block) => block.id));
    if ((input.blocks ?? []).some((block) => !validBlockIds.has(block.blockId))) return Response.json({ error: "Uno de los bloques no pertenece a tu rutina." }, { status: 403 });
    const inputRoutineName = input.routineNameSnapshot?.trim() ?? "";
    const storedRoutineName = existingSession?.routineNameSnapshot.trim() ?? "";
    const assignedRoutineName = assignment.routine.name.trim();
    const detachedHistory = Boolean(existingSession && existingSession.routineId === null);
    const routineNameSnapshot = inputRoutineName || storedRoutineName || assignedRoutineName || (detachedHistory ? "Rutina eliminada" : "");
    if (!routineNameSnapshot) return Response.json({ error: "No se pudo identificar el nombre histórico de la rutina." }, { status: 400 });

    const requestedDayNumber = input.routineDayNumberSnapshot;
    const routineDayNumberSnapshot = Number.isInteger(requestedDayNumber) && requestedDayNumber !== undefined && requestedDayNumber >= 1
      ? requestedDayNumber
      : existingSession?.routineDayNumberSnapshot ?? day.dayNumber;
    if (!Number.isInteger(routineDayNumberSnapshot) || routineDayNumberSnapshot < 1) {
      return Response.json({ error: "No se pudo identificar el día histórico de la rutina." }, { status: 400 });
    }
    const routineDayNameSnapshot = input.dayName?.trim()
      || existingSession?.routineDayNameSnapshot.trim()
      || day.name.trim()
      || `Día ${routineDayNumberSnapshot}`;
    const routineDayEstimatedMinutesSnapshot = input.dayEstimatedMinutes
      ?? existingSession?.routineDayEstimatedMinutesSnapshot
      ?? day.estimatedMinutes;

    const programmedExercises = new Map(day.exercises.map((exercise) => [exercise.id, exercise]));
    const exerciseCreates: Prisma.WorkoutExerciseLogUncheckedCreateWithoutSessionInput[] = [];
    for (const exercise of input.exercises) {
      const programmed = programmedExercises.get(exercise.exerciseId);
      if (!programmed) return Response.json({ error: "Uno de los ejercicios no pertenece al día seleccionado." }, { status: 400 });
      const previousSnapshot = existingSession?.exercises.find((item) => item.exerciseId === exercise.exerciseId);
      const exerciseName = previousSnapshot?.exerciseName?.trim() || programmed.name.trim();
      const exerciseReferenceId = previousSnapshot?.exerciseReferenceId ?? previousSnapshot?.exerciseId ?? exercise.exerciseId;
      if (!exerciseName || !exerciseReferenceId) return Response.json({ error: "No se pudo construir el snapshot histórico de un ejercicio." }, { status: 400 });
      exerciseCreates.push({
        exerciseId: exercise.exerciseId,
        exerciseReferenceId,
        observation: exercise.observation.trim(),
        snapshotVersion: previousSnapshot ? previousSnapshot.snapshotVersion : 1,
        exerciseName,
        targetSets: previousSnapshot?.targetSets ?? programmed.sets,
        targetRepetitions: previousSnapshot?.targetRepetitions ?? programmed.repetitions,
        suggestedWeight: previousSnapshot ? previousSnapshot.suggestedWeight : programmed.weight,
        targetEffortType: previousSnapshot?.targetEffortType ?? programmed.effortType,
        targetEffortValue: previousSnapshot ? previousSnapshot.targetEffortValue : programmed.effortValue,
        targetRestSeconds: previousSnapshot ? previousSnapshot.targetRestSeconds : programmed.restSeconds,
        coachInstructions: previousSnapshot?.coachInstructions ?? programmed.observations,
        exerciseOrder: previousSnapshot?.exerciseOrder ?? programmed.order,
        routineName: previousSnapshot?.routineName?.trim() || routineNameSnapshot,
        routineDayNumber: previousSnapshot?.routineDayNumber ?? routineDayNumberSnapshot,
        sets: { create: exercise.sets.map((set) => ({ setNumber: set.setNumber, weight: set.weight, repetitions: set.repetitions, effort: set.effort, completed: set.completed, observation: set.observation.trim() })) },
      });
    }
    const programmedBlocks = new Map(day.blocks.map((block) => [block.id, block]));
    const blockCreates: Prisma.WorkoutBlockLogUncheckedCreateWithoutSessionInput[] = [];
    for (const block of input.blocks ?? []) {
      const programmed = programmedBlocks.get(block.blockId);
      if (!programmed) return Response.json({ error: "Uno de los bloques no pertenece al día seleccionado." }, { status: 400 });
      const previousSnapshot = existingSession?.blocks.find((item) => item.blockId === block.blockId);
      blockCreates.push({
        blockId: block.blockId,
        blockReferenceId: previousSnapshot?.blockReferenceId ?? block.blockId,
        snapshotVersion: previousSnapshot?.snapshotVersion ?? 1,
        blockName: previousSnapshot?.blockName ?? programmed.name,
        blockType: previousSnapshot?.blockType ?? programmed.type,
        blockOrder: previousSnapshot?.blockOrder ?? programmed.order,
        blockConfiguration: (previousSnapshot?.blockConfiguration ?? block.configuration) as Prisma.InputJsonValue,
        exercisesSnapshot: (previousSnapshot?.exercisesSnapshot ?? block.exercises) as Prisma.InputJsonValue,
        result: block.result as unknown as Prisma.InputJsonValue,
        completed: block.result.completed,
      });
    }

    saveStage = "database-transaction";
    const saved = await prisma.$transaction(async (transaction) => {
      const lockKey = weeklySessionLockKey(session.studentId, input.routineId, input.dayId, weekRange.weekKey);
      await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`);
      if (!resolvedSessionId) {
        const duplicate = await transaction.workoutSession.findFirst({
          where: { studentId: session.studentId, routineId: input.routineId, dayId: input.dayId, date: { gte: weekRange.startDate, lt: weekRange.endExclusiveDate } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: { id: true, status: true },
        });
        if (duplicate) throw new Error(`WEEKLY_SESSION:${duplicate.status}:${duplicate.id}`);
      }
      if (resolvedSessionId) {
        const existing = await transaction.workoutSession.findFirst({ where: { id: resolvedSessionId, studentId: session.studentId }, select: { id: true, status: true } });
        if (!existing) throw new Error("NOT_FOUND");
        if (existing.status === "COMPLETED") throw new Error("COMPLETED_SESSION");
        await transaction.workoutExerciseLog.deleteMany({ where: { sessionId: existing.id } });
        await transaction.workoutBlockLog.deleteMany({ where: { sessionId: existing.id } });
      }
      const data = {
        studentId: session.studentId,
        routineId: input.routineId,
        dayId: input.dayId,
        routineNameSnapshot,
        routineDayNumberSnapshot,
        routineDayNameSnapshot,
        routineDayEstimatedMinutesSnapshot,
        date: existingSession?.date ?? dateKeyToDatabase(input.date),
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        energyBefore: input.energyBefore ?? null,
        difficulty: input.difficulty ?? null,
        energyAfter: input.energyAfter ?? null,
        finalComment: input.finalComment.trim(),
        hasPain: input.hasPain,
        painDetails: input.painDetails.trim(),
        status: input.status === "finalizado" ? "COMPLETED" as const : input.status === "en_progreso" ? "IN_PROGRESS" as const : "PENDING" as const,
        exercises: {
          create: exerciseCreates,
        },
        blocks: {
          create: blockCreates,
        },
      };
      return resolvedSessionId
        ? transaction.workoutSession.update({ where: { id: resolvedSessionId }, data })
        : transaction.workoutSession.create({ data });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    saveStage = "post-save";
    const student = session.credential.student.data as unknown as Student;
    const achievements = input.status === "finalizado"
      ? (await loadStrengthAchievements(session.studentId, new Date(`${bmTrainingActivityStart(student.joinedAt)}T12:00:00Z`))).filter((achievement) => achievement.sessionId === saved.id)
      : [];
    const claimedAchievements = input.status === "finalizado"
      ? await notifyNewAchievements(session.studentId)
      : [];
    const pointResult = await reconcileStudentPointsAfterMutation(session.studentId);
    const newAchievements = await achievementCelebrationPayload(session.studentId, claimedAchievements);
    return Response.json({
      id: saved.id,
      status: input.status,
      achievements,
      newAchievements,
      pointsAwarded: pointResult?.gained.reduce((sum, item) => sum + item.points, 0) ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "El entrenamiento ya no existe o no te pertenece." }, { status: 404 });
    if (error instanceof Error && error.message === "COMPLETED_SESSION") return Response.json({ error: "Una sesión finalizada no puede modificarse ni reabrirse." }, { status: 409 });
    if (error instanceof Error && error.message.startsWith("WEEKLY_SESSION:")) {
      const [, status, id] = error.message.split(":");
      if (status === "COMPLETED" && parsedInput?.status === "finalizado") return Response.json({ id, status: "finalizado", reused: true });
      if (status === "IN_PROGRESS" && parsedInput?.status === "en_progreso") return Response.json({ id, status: "en_progreso", reused: true });
      return Response.json({ error: status === "COMPLETED" ? "Este día ya fue finalizado durante la semana actual." : "La sesión se creó al mismo tiempo. Reintentá para continuarla sin duplicar datos." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La sesión cambió mientras la guardabas. Recargá Mi rutina antes de volver a intentar." }, { status: 409 });
    console.error("Error al guardar entrenamiento del portal", { status: 500, saveStage, message: error instanceof Error ? error.message : String(error), payload: process.env.NODE_ENV === "development" ? parsedInput : undefined, error });
    const developmentDetail = process.env.NODE_ENV === "development" ? `${saveStage}: ${error instanceof Error ? error.message : String(error)}` : undefined;
    return Response.json({ error: "No se pudo guardar el entrenamiento.", ...(developmentDetail ? { developmentDetail } : {}) }, { status: 500 });
  }
}
