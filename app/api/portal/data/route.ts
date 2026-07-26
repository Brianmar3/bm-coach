import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";
import { serializeEvaluation } from "@/lib/evaluaciones";
import { serializeEvent } from "@/lib/eventos";
import type { CoachSettings, Student } from "@/types/gestion";
import type { PortalData } from "@/types/portal";
import type { Prisma } from "@prisma/client";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { calculatePortalAchievements } from "@/lib/portal-achievements";
import { portalPaymentAccount, serializePayment } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadHomeInsights(studentId: string, primaryScheduleId: string | null, joinedAt: string, todayKey: string, weekStart: Date) {
  const today = dateKeyToDatabase(todayKey);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const meaningfulEvaluation = {
    studentId,
    OR: [
      { weight: { not: null } }, { height: { not: null } }, { bodyFatPercentage: { not: null } },
      { muscleMass: { not: null } }, { waist: { not: null } }, { hip: { not: null } },
    ],
  } satisfies Prisma.PhysicalEvaluationWhereInput;
  const [
    completedWorkoutCount,
    completedWorkoutDates,
    weeklyWorkoutCount,
    newAttendanceCount,
    newAttendanceDates,
    newAttendanceThisMonth,
    legacyAttendanceCount,
    legacyAttendanceDates,
    legacyAttendanceThisMonth,
    firstEvaluation,
    latestEvaluation,
    evaluationCount,
    firstStrengthLog,
  ] = await Promise.all([
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED" } }),
    prisma.workoutSession.findMany({ where: { studentId, status: "COMPLETED" }, select: { date: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 10 }),
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED", date: { gte: weekStart } } }),
    prisma.classOccurrenceAttendance.count({ where: { studentId, actualAttendance: "PRESENT" } }),
    prisma.classOccurrenceAttendance.findMany({ where: { studentId, actualAttendance: "PRESENT" }, select: { occurrence: { select: { date: true } } }, orderBy: { occurrence: { date: "asc" } }, take: 10 }),
    prisma.classOccurrenceAttendance.count({ where: { studentId, actualAttendance: "PRESENT", occurrence: { date: { gte: monthStart, lte: today } } } }),
    prisma.classAttendance.count({ where: { studentId, status: "PRESENT" } }),
    prisma.classAttendance.findMany({ where: { studentId, status: "PRESENT" }, select: { date: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 10 }),
    prisma.classAttendance.count({ where: { studentId, status: "PRESENT", date: { gte: monthStart, lte: today } } }),
    prisma.physicalEvaluation.findFirst({ where: meaningfulEvaluation, select: { date: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.physicalEvaluation.findFirst({ where: meaningfulEvaluation, select: { date: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.physicalEvaluation.count({ where: meaningfulEvaluation }),
    prisma.classWorkoutLog.findFirst({ where: { studentId, status: "COMPLETED" }, select: { classDateSnapshot: true }, orderBy: [{ classDateSnapshot: "asc" }, { createdAt: "asc" }] }),
  ]);
  const usesOccurrenceAttendance = newAttendanceCount > 0;
  const attendedClassCount = usesOccurrenceAttendance ? newAttendanceCount : legacyAttendanceCount;
  const attendedClassDates = usesOccurrenceAttendance
    ? newAttendanceDates.map((item) => item.occurrence.date.toISOString().slice(0, 10))
    : legacyAttendanceDates.map((item) => item.date.toISOString().slice(0, 10));
  return {
    weeklyWorkoutCount,
    classesAttendedThisMonth: usesOccurrenceAttendance ? newAttendanceThisMonth : legacyAttendanceThisMonth,
    hasClassParticipation: Boolean(primaryScheduleId) || newAttendanceCount > 0 || legacyAttendanceCount > 0 || Boolean(firstStrengthLog),
    achievements: calculatePortalAchievements({
      completedWorkoutCount,
      completedWorkoutDates: completedWorkoutDates.map((item) => item.date.toISOString().slice(0, 10)),
      attendedClassCount,
      attendedClassDates,
      firstEvaluationDate: firstEvaluation?.date.toISOString().slice(0, 10) ?? "",
      latestEvaluationDate: latestEvaluation?.date.toISOString().slice(0, 10) ?? "",
      evaluationCount,
      firstStrengthLogDate: firstStrengthLog?.classDateSnapshot.toISOString().slice(0, 10) ?? "",
      joinedAt,
      today: todayKey,
    }),
  };
}

export async function GET(request: Request) {
  try {
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    const studentId = session.studentId;
    const section = new URL(request.url).searchParams.get("section") ?? "inicio";
    const fullWorkoutHistory = section === "rutina" || section === "entrenamiento";
    const fullEvaluationHistory = section === "evaluaciones";
    const fullPaymentHistory = section === "pagos";
    const todayKey = argentinaDateKey();
    const today = dateKeyToDatabase(todayKey);
    const weekStart = new Date(today); weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const student = session.credential.student.data as unknown as Student;
    const homeInsightsPromise = section === "inicio"
      ? loadHomeInsights(studentId, session.credential.student.primaryScheduleId, student.joinedAt, todayKey, weekStart)
      : Promise.resolve({ weeklyWorkoutCount: 0, classesAttendedThisMonth: 0, hasClassParticipation: false, achievements: [] });
    const [routine, evaluations, payments, events, workoutSessions, comments, nextClass, homeInsights, settingsRecord] = await Promise.all([
      prisma.trainingRoutine.findFirst({ where: { status: "ACTIVA", assignments: { some: { studentId, active: true } } }, include: routineInclude, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: { studentId }, include: { student: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: fullEvaluationHistory ? undefined : section === "inicio" ? 12 : 2 }),
      prisma.studentPayment.findMany({ where: { studentId, status: "PAGADO" }, include: { student: true }, orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }], take: fullPaymentHistory ? 50 : section === "inicio" ? 1 : 0 }),
      prisma.coachEvent.findMany({ where: { status: "PENDIENTE", date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8 }),
      prisma.workoutSession.findMany({
        where: { studentId },
        include: { day: true, routine: true, exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: fullWorkoutHistory ? 30 : 5,
      }),
      prisma.followUpComment.findMany({
        where: { studentId, private: false },
        include: { exercise: true },
        orderBy: { createdAt: "desc" },
      }),
      session.credential.student.primaryScheduleId
        ? prisma.weeklyClassSchedule.findUnique({ where: { id: session.credential.student.primaryScheduleId } })
        : Promise.resolve(null),
      homeInsightsPromise,
      section === "pagos" ? prisma.coachSettingsRecord.findFirst({ orderBy: { updatedAt: "desc" } }) : Promise.resolve(null),
    ]);
    const settings = settingsRecord?.data as unknown as CoachSettings | undefined;
    const privateRoutine = routine ? { ...serializeRoutine(routine), studentIds: [studentId], students: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }], historicalStudents: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }] } : null;
    const data: PortalData = {
      profile: { id: studentId, firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: student.email, birthDate: student.birthDate, goal: student.goal, plan: student.plan, joinedAt: student.joinedAt, status: student.status, dueDate: student.dueDate },
      routine: privateRoutine,
      evaluations: evaluations.map(serializeEvaluation),
      payments: payments.map(serializePayment),
      paymentAccount: portalPaymentAccount(student, payments, todayKey),
      paymentMethods: settings?.paymentMethods?.filter((method) => method.trim().length > 0) ?? [],
      events: events.map(serializeEvent),
      workoutSessions: workoutSessions.map((workout) => ({
        id: workout.id,
        routineId: workout.routineId ?? "",
        routineName: workout.routineNameSnapshot ?? workout.exercises.find((log) => log.snapshotVersion !== null)?.routineName ?? workout.routine?.name ?? "Rutina eliminada",
        dayId: workout.dayId ?? "",
        dayNumber: workout.routineDayNumberSnapshot ?? workout.exercises.find((log) => log.snapshotVersion !== null)?.routineDayNumber ?? workout.day?.dayNumber ?? 0,
        dayName: workout.routineDayNameSnapshot?.trim() || workout.day?.name?.trim() || undefined,
        dayEstimatedMinutes: workout.routineDayEstimatedMinutesSnapshot ?? workout.day?.estimatedMinutes ?? null,
        date: workout.date.toISOString().slice(0, 10),
        startTime: workout.startTime,
        durationMinutes: workout.durationMinutes,
        energyBefore: workout.energyBefore,
        difficulty: workout.difficulty,
        energyAfter: workout.energyAfter,
        finalComment: workout.finalComment,
        hasPain: workout.hasPain,
        painDetails: workout.painDetails,
        status: workout.status === "COMPLETED" ? "finalizado" as const : workout.status === "IN_PROGRESS" ? "en_progreso" as const : "pendiente" as const,
        exercises: [...workout.exercises].sort((left, right) => (left.exerciseOrder ?? left.exercise?.order ?? 0) - (right.exerciseOrder ?? right.exercise?.order ?? 0)).map((log) => {
          const older = workoutSessions
            .filter((candidate) => candidate.id !== workout.id && candidate.date <= workout.date)
            .flatMap((candidate) => candidate.exercises.filter((item) => (item.exerciseReferenceId ?? item.exerciseId) === (log.exerciseReferenceId ?? log.exerciseId)).map((item) => ({ candidate, item })))
            .sort((left, right) => right.candidate.date.getTime() - left.candidate.date.getTime());
          const history = older.slice(0, 8).map(({ candidate, item }) => {
            const best = [...item.sets].filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? item.sets[0];
            return { date: candidate.date.toISOString().slice(0, 10), weight: best?.weight === null || best?.weight === undefined ? null : Number(best.weight), repetitions: best?.repetitions ?? null, effort: best?.effort === null || best?.effort === undefined ? null : Number(best.effort) };
          });
          return {
            id: log.id,
            exerciseId: log.exerciseReferenceId ?? log.exerciseId ?? log.id,
            exerciseName: log.snapshotVersion !== null ? log.exerciseName ?? "Ejercicio eliminado" : log.exercise?.name ?? "Ejercicio eliminado",
            observation: log.observation,
            sets: log.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, weight: set.weight === null ? null : Number(set.weight), repetitions: set.repetitions, effort: set.effort === null ? null : Number(set.effort), completed: set.completed, observation: set.observation })),
            previous: history[0] ?? null,
            history,
          };
        }),
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        author: comment.author === "COACH" ? "entrenador" as const : "alumno" as const,
        context: ({ SESSION: "sesion", EXERCISE: "ejercicio", EVALUATION: "evaluacion", GENERAL: "general" } as const)[comment.context],
        category: ({ QUESTION: "consulta", DIFFICULTY: "dificultad", PAIN: "dolor", FEEDBACK: "devolucion" } as const)[comment.category],
        status: comment.status === "REVIEWED" ? "revisado" as const : "pendiente" as const,
        body: comment.body,
        contextLabel: comment.exercise?.name ?? ({ SESSION: "Sesión de entrenamiento", EVALUATION: "Evaluación", GENERAL: "General", EXERCISE: "Ejercicio" } as const)[comment.context],
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
      })),
      nextClass: nextClass ? { id: nextClass.id, label: nextClass.classType, startTime: nextClass.startTime } : null,
      weeklyWorkouts: workoutSessions.filter((workout) => workout.status === "COMPLETED" && workout.date >= weekStart).length,
      pendingResponses: comments.filter((comment) => comment.author === "STUDENT" && comment.status === "PENDING").length,
      home: {
        mode: routine && homeInsights.hasClassParticipation ? "MIXTO" : routine ? "RUTINA_PERSONALIZADA" : homeInsights.hasClassParticipation ? "PRESENCIAL" : "SIN_DEFINIR",
        hasClassParticipation: homeInsights.hasClassParticipation,
        classesAttendedThisMonth: homeInsights.classesAttendedThisMonth,
        achievements: homeInsights.achievements,
      },
    };
    if (section === "inicio") data.weeklyWorkouts = homeInsights.weeklyWorkoutCount;
    return Response.json(data);
  } catch (error) {
    console.error("Error al cargar datos del portal", error);
    return Response.json({ error: "No se pudo cargar tu información desde Neon." }, { status: 500 });
  }
}
