import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";
import { achievementCelebrationPayload, notifyNewAchievements } from "@/lib/push-notifications";

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
    const [sessions, students, routines, classSessions, activeAssignments] = await Promise.all([
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
      prisma.classWorkoutLog.findMany({
        where: { ...(studentId ? { studentId } : {}) },
        include: { student: true, exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { setNumber: "asc" } } } } },
        orderBy: { classDateSnapshot: "desc" },
        take: 100,
      }),
      prisma.trainingRoutineAssignment.findMany({
        where: { active: true, ...(studentId ? { studentId } : {}) },
        include: { student: true, routine: true },
        orderBy: { assignedAt: "desc" },
      }),
    ]);
    const exerciseIds = [...new Set(sessions.flatMap((session) => session.exercises.map((log) => log.exerciseReferenceId ?? log.exerciseId).filter((id): id is string => Boolean(id))))];
    const previousLogs = exerciseIds.length ? await prisma.workoutExerciseLog.findMany({
      where: { OR: [{ exerciseReferenceId: { in: exerciseIds } }, { exerciseId: { in: exerciseIds } }], session: { status: "COMPLETED" } },
      include: { sets: true, session: { select: { id: true, studentId: true, date: true } } },
      orderBy: { session: { date: "desc" } },
    }) : [];
    const trained = new Set(sessions.filter((item) => item.status === "COMPLETED").map((item) => item.studentId));
    const serializedSessions = sessions.map((session) => {
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
      });
    const classStudentIds = new Set(classSessions.map((session) => session.studentId));
    const assignedByStudent = new Map<string, (typeof activeAssignments)[number]>();
    for (const assignment of activeAssignments) {
      if (!assignedByStudent.has(assignment.studentId)) assignedByStudent.set(assignment.studentId, assignment);
    }
    const studentIds = new Set([...assignedByStudent.keys(), ...serializedSessions.map((session) => session.studentId)]);
    const followUpStudents = [...studentIds].map((id) => {
      const student = students.find((item) => item.id === id);
      const studentData = student?.data as unknown as Student | undefined;
      const studentSessions = serializedSessions.filter((session) => session.studentId === id);
      const completed = studentSessions.filter((session) => session.status === "completed");
      const latestSession = studentSessions[0] ?? null;
      const durations = completed.flatMap((session) => session.durationMinutes === null ? [] : [session.durationMinutes]);
      const latestPain = studentSessions.find((session) => session.hasPain);
      const assignment = assignedByStudent.get(id);
      const recentLimit = new Date();
      recentLimit.setDate(recentLimit.getDate() - 28);
      const latestProgress = latestSession?.exercises.flatMap((exercise) => {
        const current = exercise.sets.filter((set) => set.completed).sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0))[0];
        if (!current || !exercise.previous) return [];
        const weightChange = (current.weight ?? 0) - (exercise.previous.weight ?? 0);
        const repetitionsChange = (current.repetitions ?? 0) - (exercise.previous.repetitions ?? 0);
        if (weightChange > 0) return [`Aumentó ${weightChange.toLocaleString("es-AR")} kg en ${exercise.name}`];
        if (weightChange === 0 && repetitionsChange > 0) return [`Completó ${repetitionsChange} repeticiones más en ${exercise.name}`];
        return [];
      })[0] ?? "";
      return {
        studentId: id,
        studentName: student ? name(student.data) : latestSession?.studentName ?? "Alumno",
        profileImageUrl: studentData?.profileImageUrl ?? "",
        activeRoutine: assignment ? {
          id: assignment.routine.id,
          name: assignment.routine.name,
          status: assignment.routine.status.toLowerCase(),
          startDate: assignment.routine.startDate?.toISOString().slice(0, 10) ?? "",
        } : null,
        latestSession,
        sessionCount: completed.length,
        averageDuration: durations.length ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length) : null,
        exerciseCount: completed.reduce((sum, session) => sum + session.exerciseCount, 0),
        completedSets: completed.reduce((sum, session) => sum + session.completedSets, 0),
        recentSessionCount: completed.filter((session) => new Date(`${session.date}T12:00:00`) >= recentLimit).length,
        latestPainReport: latestPain ? { date: latestPain.date, details: latestPain.painDetails || "Sin detalle informado." } : null,
        recentProgress: latestProgress,
        hasClassStrength: classStudentIds.has(id),
      };
    }).sort((left, right) => {
      const dateDifference = (right.latestSession?.date ?? "").localeCompare(left.latestSession?.date ?? "");
      return dateDifference || left.studentName.localeCompare(right.studentName, "es");
    });
    return Response.json({
      sessions: serializedSessions,
      students: followUpStudents,
      routines,
      classSessions: classSessions.map((session) => ({
        id: session.id,
        occurrenceId: session.occurrenceId,
        studentId: session.studentId,
        studentName: name(session.student.data),
        className: session.classNameSnapshot,
        date: session.classDateSnapshot.toISOString().slice(0, 10),
        status: session.status,
        notes: session.notes,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        exercises: session.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.exerciseNameSnapshot,
          order: exercise.order,
          notes: exercise.notes,
          sets: exercise.sets.map((set) => ({ setNumber: set.setNumber, weight: decimal(set.weight), repetitions: set.repetitions, effort: decimal(set.effort), unit: set.unit, notes: set.notes })),
        })),
      })),
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
    if (body && !input.private) {
      await prisma.studentNotification.create({
        data: {
          studentId: session.studentId,
          type: "FEEDBACK",
          title: "Nueva devolución",
          message: "Tu entrenador dejó una devolución sobre tu entrenamiento.",
          url: "/portal/rutina#historial-entrenamientos",
        },
      }).catch((error) => {
        console.error("No se pudo crear la notificación interna del alumno", error);
      });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error al responder seguimiento", error);
    return Response.json({ error: "No se pudo actualizar el seguimiento." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const input = await request.json() as {
      classWorkoutLogId?: unknown;
      status?: unknown;
      notes?: unknown;
      exercises?: Array<{ id?: unknown; exerciseName?: unknown; order?: unknown; notes?: unknown; sets?: Array<{ setNumber?: unknown; weight?: unknown; repetitions?: unknown; effort?: unknown; notes?: unknown }> }>;
    };
    if (typeof input.classWorkoutLogId === "string") {
      return Response.json(
        { error: "Los registros presenciales históricos son de solo lectura. Usá Registro rápido para nuevas cargas." },
        { status: 410 },
      );
    }
    if (typeof input.classWorkoutLogId !== "string" || !["DRAFT", "COMPLETED"].includes(String(input.status)) || !Array.isArray(input.exercises) || input.exercises.length > 30) {
      return Response.json({ error: "El bloque seleccionado no es válido." }, { status: 400 });
    }
    const exercises = input.exercises.map((exercise, index) => {
      const exerciseName = typeof exercise.exerciseName === "string" ? exercise.exerciseName.trim() : "";
      const order = Number(exercise.order ?? index + 1);
      if (!exerciseName || exerciseName.length > 120 || !Number.isInteger(order) || order < 1 || !Array.isArray(exercise.sets) || exercise.sets.length > 20) throw new Error("INVALID_CLASS_LOG");
      return {
        id: typeof exercise.id === "string" ? exercise.id : null,
        exerciseNameSnapshot: exerciseName,
        order,
        notes: typeof exercise.notes === "string" ? exercise.notes.trim().slice(0, 1000) : "",
        sets: exercise.sets.map((set, setIndex) => {
          const setNumber = Number(set.setNumber ?? setIndex + 1);
          const weight = set.weight === null || set.weight === "" ? null : Number(set.weight);
          const repetitions = set.repetitions === null || set.repetitions === "" ? null : Number(set.repetitions);
          const effort = set.effort === null || set.effort === "" ? null : Number(set.effort);
          if (!Number.isInteger(setNumber) || setNumber < 1 || (weight !== null && (!Number.isFinite(weight) || weight < 0)) || (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0)) || (effort !== null && (!Number.isFinite(effort) || effort < 0 || effort > 10))) throw new Error("INVALID_CLASS_LOG");
          return { setNumber, weight, repetitions, effort, unit: "kg", notes: typeof set.notes === "string" ? set.notes.trim().slice(0, 500) : "" };
        }),
      };
    });
    const existing = await prisma.classWorkoutLog.findUnique({
      where: { id: input.classWorkoutLogId },
      select: {
        id: true,
        studentId: true,
        exercises: { select: { id: true, order: true } },
      },
    });
    if (!existing) return Response.json({ error: "No se encontró el bloque." }, { status: 404 });
    await prisma.$transaction(async (transaction) => {
      await transaction.classWorkoutLog.update({
        where: { id: existing.id },
        data: { status: input.status === "COMPLETED" ? "COMPLETED" : "DRAFT", notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 2000) : "", completedAt: input.status === "COMPLETED" ? new Date() : null, lastEditedBy: "TRAINER" },
      });
      const storedIds = new Set(
        existing.exercises.map((exercise) => exercise.id),
      );
      const storedByOrder = new Map(
        existing.exercises.map((exercise) => [exercise.order, exercise.id]),
      );
      const resolved = exercises.map((exercise) => {
        if (exercise.id && !storedIds.has(exercise.id)) {
          throw new Error("INVALID_CLASS_LOG");
        }
        return {
          ...exercise,
          id: exercise.id ?? storedByOrder.get(exercise.order) ?? null,
        };
      });
      const retainedIds = resolved.flatMap((exercise) =>
        exercise.id ? [exercise.id] : [],
      );
      await transaction.classExerciseLog.deleteMany({
        where: {
          classWorkoutLogId: existing.id,
          ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
        },
      });
      for (const exercise of resolved) {
        const { id, sets, ...exerciseData } = exercise;
        if (id) {
          await transaction.classSetLog.deleteMany({
            where: { classExerciseLogId: id },
          });
          await transaction.classExerciseLog.update({
            where: { id },
            data: { ...exerciseData, sets: { create: sets } },
          });
        } else {
          await transaction.classExerciseLog.create({
            data: {
              ...exerciseData,
              classWorkoutLogId: existing.id,
              sets: { create: sets },
            },
          });
        }
      }
    });
    const claimedAchievements = input.status === "COMPLETED"
      ? await notifyNewAchievements(existing.studentId)
      : [];
    const pointResult = await reconcileStudentPointsAfterMutation(existing.studentId);
    const newAchievements = await achievementCelebrationPayload(existing.studentId, claimedAchievements);
    return Response.json({
      message: "Bloque de fuerza actualizado correctamente.",
      newAchievements,
      pointsAwarded: pointResult?.gained.reduce((sum, item) => sum + item.points, 0) ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CLASS_LOG") return Response.json({ error: "Revisá ejercicios, series, pesos, repeticiones y RIR." }, { status: 400 });
    console.error("Error al editar bloque de fuerza presencial", error);
    return Response.json({ error: "No se pudo guardar. Tus cambios permanecen en pantalla." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const input = await request.json().catch(() => null) as { sessionId?: string; classWorkoutLogId?: string; studentId?: string; routineId?: string; deleteAll?: boolean } | null;
    if (input?.classWorkoutLogId?.trim()) {
      return Response.json(
        { error: "Los registros presenciales históricos son de solo lectura y no se pueden eliminar desde este flujo." },
        { status: 410 },
      );
    }
    if (input?.deleteAll) {
      if (!input.studentId?.trim() || !input.routineId?.trim()) return Response.json({ error: "Alumno y rutina son obligatorios." }, { status: 400 });
      const result = await prisma.$transaction(async (transaction) => {
        const where = { studentId: input.studentId!, routineId: input.routineId! };
        const count = await transaction.workoutSession.count({ where });
        if (!count) return 0;
        const deleted = await transaction.workoutSession.deleteMany({ where });
        return deleted.count;
      });
      await reconcileStudentPointsAfterMutation(input.studentId);
      return Response.json({ message: `${result} registros de entrenamiento eliminados definitivamente.`, deleted: result });
    }
    if (!input?.sessionId?.trim()) return Response.json({ error: "El registro seleccionado no es válido." }, { status: 400 });
    const existingSession = await prisma.workoutSession.findUnique({
      where: { id: input.sessionId },
      select: { studentId: true },
    });
    const deleted = await prisma.workoutSession.deleteMany({ where: { id: input.sessionId } });
    if (!deleted.count) return Response.json({ error: "Registro de entrenamiento no encontrado." }, { status: 404 });
    if (existingSession) {
      await reconcileStudentPointsAfterMutation(existingSession.studentId);
    }
    return Response.json({ message: "Registro de entrenamiento eliminado correctamente.", deleted: 1 });
  } catch (error) {
    console.error("Error al eliminar seguimiento", error);
    return Response.json({ error: "No se pudo eliminar el registro de entrenamiento." }, { status: 500 });
  }
}
