import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";
import { evaluationInclude, normalizeLegacyEvaluationRecord, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";
import { deduplicateEvaluations, toStudentEvaluation } from "@/lib/evaluation-read-model";
import { serializeEvent } from "@/lib/eventos";
import type { CoachSettings, Student } from "@/types/gestion";
import type { PortalData } from "@/types/portal";
import type { Prisma } from "@prisma/client";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { calculatePortalAchievements } from "@/lib/portal-achievements";
import { loadStrengthAchievements } from "@/lib/strength-achievements";
import { portalPaymentAccount, serializePayment } from "@/lib/payments";
import { weeklyScheduleLabel } from "@/lib/student-enrollment";
import { planDays } from "@/lib/student-enrollment";
import { BM_TRAINING_START_DATE } from "@/lib/bm-training";
import { hasGroupClasses, isAchievementEligibleForService } from "@/lib/student-service";
import { activePortalRoutineWhere } from "@/lib/portal-service-access";
import { loadQuickLogAchievements } from "@/lib/quick-log-achievements";
import { loadStudentPointSummary } from "@/lib/student-points";
import { loadUnifiedRecordAchievements } from "@/lib/unified-record-achievements";
import { mergePortalAttendanceRecords, type PortalAttendanceRecord } from "@/lib/portal-attendance";
import { loadPortalAttendance } from "@/lib/portal-attendance-data";
import { loadCurrentWeeklyMission } from "@/lib/weekly-mission-data";
import { exerciseMediaAvailable } from "@/lib/exercise-library-server";
import { obligationStatus } from "@/lib/monthly-calculations";
import { normalizeTransferDetails } from "@/lib/transfer-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadHomeInsights(studentId: string, primaryScheduleId: string | null, joinedAt: string, studentStatus: string, plan: string, todayKey: string, weekStart: Date, includeClasses: boolean, serviceType: "CLASSES" | "PERSONALIZED" | "MIXED", pointMovementLimit = 8) {
  const activityStartKey = joinedAt && joinedAt > BM_TRAINING_START_DATE ? joinedAt : BM_TRAINING_START_DATE;
  const activityStart = dateKeyToDatabase(activityStartKey);
  const meaningfulEvaluation = {
    studentId,
    status: { in: ["COMPLETED", "REASSESSMENT_RECOMMENDED"] },
    OR: [
      { weight: { not: null } }, { height: { not: null } }, { bodyFatPercentage: { not: null } },
      { muscleMass: { not: null } }, { waist: { not: null } }, { hip: { not: null } },
    ],
  } satisfies Prisma.PhysicalEvaluationWhereInput;
  const [
    completedWorkoutDates,
    weeklyWorkoutCount,
    newAttendanceDates,
    legacyAttendanceDates,
    currentMonthAttendance,
    previousMonthAttendance,
    evaluationDates,
    firstStrengthLog,
    strengthAchievements,
    quickLogAchievements,
    unifiedRecordAchievements,
    activeRoutineCount,
    points,
  ] = await Promise.all([
    prisma.workoutSession.findMany({ where: { studentId, status: "COMPLETED", date: { gte: activityStart } }, select: { date: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED", date: { gte: weekStart } } }),
    includeClasses ? prisma.classOccurrenceAttendance.findMany({ where: { studentId, actualAttendance: { in: ["PRESENT", "ABSENT"] }, occurrence: { date: { gte: activityStart }, status: { not: "CANCELLED" } } }, select: { id: true, actualAttendance: true, occurrence: { select: { date: true, classNameSnapshot: true, startTime: true, endTime: true, scheduleId: true } } }, orderBy: { occurrence: { date: "asc" } } }) : Promise.resolve([]),
    includeClasses ? prisma.classAttendance.findMany({ where: { studentId, date: { gte: activityStart } }, select: { id: true, date: true, status: true, scheduleLabel: true, scheduleStartTime: true, scheduleId: true, schedule: { select: { endTime: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    includeClasses ? loadPortalAttendance(studentId, "current-month", todayKey) : Promise.resolve(null),
    includeClasses ? loadPortalAttendance(studentId, "previous-month", todayKey) : Promise.resolve(null),
    prisma.physicalEvaluation.findMany({ where: { ...meaningfulEvaluation, date: { gte: activityStart } }, select: { date: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    includeClasses ? prisma.classWorkoutLog.findFirst({ where: { studentId, status: "COMPLETED", classDateSnapshot: { gte: activityStart } }, select: { classDateSnapshot: true }, orderBy: [{ classDateSnapshot: "asc" }, { createdAt: "asc" }] }) : Promise.resolve(null),
    loadStrengthAchievements(studentId, activityStart),
    loadQuickLogAchievements(studentId),
    loadUnifiedRecordAchievements(studentId, activityStart),
    prisma.trainingRoutine.count({ where: activePortalRoutineWhere(studentId) }),
    loadStudentPointSummary(studentId, pointMovementLimit),
  ]);
  const currentAttendance: PortalAttendanceRecord[] = newAttendanceDates.map((item) => ({
    id: item.id,
    date: item.occurrence.date.toISOString().slice(0, 10),
    className: item.occurrence.classNameSnapshot,
    startTime: item.occurrence.startTime,
    endTime: item.occurrence.endTime,
    status: item.actualAttendance as "PRESENT" | "ABSENT",
    source: "current",
    scheduleId: item.occurrence.scheduleId,
  }));
  const legacyAttendance: PortalAttendanceRecord[] = legacyAttendanceDates.map((item) => ({
    id: item.id,
    date: item.date.toISOString().slice(0, 10),
    className: item.scheduleLabel,
    startTime: item.scheduleStartTime,
    endTime: item.schedule?.endTime ?? "",
    status: item.status,
    source: "legacy",
    scheduleId: item.scheduleId,
  }));
  const attendanceRecords = mergePortalAttendanceRecords(currentAttendance, legacyAttendance);
  const attendedClassDates = attendanceRecords.filter((record) => record.status === "PRESENT").map((record) => record.date).sort();
  const evaluationDateKeys = evaluationDates.map((item) => item.date.toISOString().slice(0, 10));
  const hasClassParticipation = includeClasses && (Boolean(primaryScheduleId) || attendedClassDates.length > 0 || Boolean(firstStrengthLog));
  const weeklyGoal = includeClasses ? planDays(plan) ?? 0 : 0;
  const hasPreviousMonthData = (previousMonthAttendance?.total ?? 0) > 0;
  const weeklyMission = await loadCurrentWeeklyMission(studentId, todayKey);
  return {
    weeklyWorkoutCount,
    classesAttendedThisMonth: currentMonthAttendance?.completedDays ?? currentMonthAttendance?.present ?? 0,
    monthlyAttendancePercentage: currentMonthAttendance?.percentage ?? null,
    classesAttendedPreviousMonth: hasPreviousMonthData ? previousMonthAttendance?.completedDays ?? previousMonthAttendance?.present ?? 0 : null,
    previousMonthAttendancePercentage: previousMonthAttendance?.percentage ?? null,
    hasClassParticipation,
    weeklyMission,
    achievements: [...calculatePortalAchievements({
      completedWorkoutDates: completedWorkoutDates.map((item) => item.date.toISOString().slice(0, 10)),
      attendedClassDates,
      evaluationDates: evaluationDateKeys,
      firstStrengthLogDate: firstStrengthLog?.classDateSnapshot.toISOString().slice(0, 10) ?? "",
      joinedAt,
      today: todayKey,
      weeklyGoal,
      active: studentStatus !== "inactivo",
      hasRoutine: activeRoutineCount > 0 || completedWorkoutDates.length > 0,
      hasClassParticipation,
    }), ...strengthAchievements.filter((item) => !item.id.includes("-weight-") && !item.id.includes("-reps-")), ...quickLogAchievements.filter((item) => item.id.includes(":milestone:")), ...unifiedRecordAchievements].filter((item) => isAchievementEligibleForService(serviceType, item)).sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt)),
    points,
  };
}

export async function GET(request: Request) {
  try {
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    const studentId = session.studentId;
    const serviceType = session.credential.student.serviceType;
    const groupClassesEnabled = hasGroupClasses(serviceType);
    const section = new URL(request.url).searchParams.get("section") ?? "inicio";
    const fullWorkoutHistory = section === "rutina" || section === "entrenamiento";
    const fullEvaluationHistory = section === "evaluaciones";
    const fullPaymentHistory = section === "pagos";
    const todayKey = argentinaDateKey();
    const today = dateKeyToDatabase(todayKey);
    const weekStart = new Date(today); weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const student = session.credential.student.data as unknown as Student;
    const homeInsightsPromise = section === "inicio" || section === "puntos" || section === "puntos-historial"
      ? loadHomeInsights(studentId, session.credential.student.primaryScheduleId, student.joinedAt, student.status, student.plan, todayKey, weekStart, groupClassesEnabled, serviceType, section === "puntos-historial" ? 40 : 8)
      : Promise.resolve({ weeklyWorkoutCount: 0, classesAttendedThisMonth: 0, monthlyAttendancePercentage: null, classesAttendedPreviousMonth: null, previousMonthAttendancePercentage: null, hasClassParticipation: false, weeklyMission: null, achievements: [], points: { total: 0, monthlyTotal: 0, latest: null, recent: [], nextTarget: 50, pointsToNextTarget: 50 } });
    const [routine, evaluations, legacyEvaluationRecords, payments, events, workoutSessions, comments, nextClass, homeInsights, settingsRecord, studentSchedules, paymentObligationRecords, paidAmountsByPeriod] = await Promise.all([
      prisma.trainingRoutine.findFirst({ where: activePortalRoutineWhere(studentId), include: routineInclude, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: { studentId, status: { in: ["COMPLETED", "REASSESSMENT_RECOMMENDED"] } }, include: evaluationInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: fullEvaluationHistory ? undefined : section === "inicio" ? 12 : 2 }),
      prisma.evaluationRecord.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.studentPayment.findMany({ where: { studentId, status: "PAGADO" }, include: { student: true }, orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }], take: fullPaymentHistory ? 50 : section === "inicio" ? 1 : 0 }),
      prisma.coachEvent.findMany({ where: { status: "PENDIENTE", showToStudents: true, audience: { in: ["ALL", serviceType] }, date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8 }),
      prisma.workoutSession.findMany({
        where: { studentId },
        include: { day: true, routine: true, blocks: true, exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: fullWorkoutHistory ? 30 : 5,
      }),
      prisma.followUpComment.findMany({
        where: { studentId, private: false },
        include: { exercise: true },
        orderBy: { createdAt: "desc" },
      }),
      groupClassesEnabled && session.credential.student.primaryScheduleId
        ? prisma.weeklyClassSchedule.findUnique({ where: { id: session.credential.student.primaryScheduleId } })
        : Promise.resolve(null),
      homeInsightsPromise,
      section === "pagos" || section === "inicio" ? prisma.coachSettingsRecord.findFirst({ orderBy: { updatedAt: "desc" } }) : Promise.resolve(null),
      groupClassesEnabled ? prisma.weeklyClassAssignment.findMany({ where: { studentId, active: true }, include: { schedule: true }, orderBy: { schedule: { startTime: "asc" } } }) : Promise.resolve([]),
      section === "pagos" ? prisma.monthlyStudentObligation.findMany({ where: { studentId }, orderBy: [{ period: "desc" }, { dueDate: "desc" }], take: 12 }) : Promise.resolve([]),
      section === "pagos" ? prisma.studentPayment.groupBy({ by: ["billingPeriod"], where: { studentId, status: "PAGADO", billingPeriod: { not: null } }, _sum: { amount: true } }) : Promise.resolve([]),
    ]);
    if ((section === "rutina" || section === "entrenamiento") && serviceType === "CLASSES" && !routine) {
      return Response.json({ error: "No tenés una rutina personalizada activa." }, { status: 403 });
    }
    const settings = settingsRecord?.data as unknown as CoachSettings | undefined;
    const paidByPeriod = new Map(paidAmountsByPeriod.flatMap((item) => item.billingPeriod ? [[databaseDateKey(item.billingPeriod), Number(item._sum.amount ?? 0)] as const] : []));
    const paymentObligations = paymentObligationRecords.map((obligation) => {
      const period = databaseDateKey(obligation.period);
      const expectedAmount = Number(obligation.expectedAmount);
      const paidAmount = paidByPeriod.get(period) ?? Number(obligation.paidAmount);
      const balance = Math.max(expectedAmount - paidAmount, 0);
      return {
        id: obligation.id,
        period,
        expectedAmount,
        paidAmount,
        balance,
        dueDate: databaseDateKey(obligation.dueDate),
        status: obligation.status === "VOID" ? "VOID" as const : obligationStatus(expectedAmount, paidAmount, databaseDateKey(obligation.dueDate), todayKey),
      };
    });
    const normalizedEvaluations = deduplicateEvaluations([
      ...evaluations.map(normalizePhysicalEvaluation),
      ...legacyEvaluationRecords.map(normalizeLegacyEvaluationRecord).filter((item) => item.studentId === studentId),
    ]).filter((item) => item.status !== "IN_PROGRESS").slice(0, fullEvaluationHistory ? undefined : section === "inicio" ? 12 : 2);
    const privateRoutine = routine ? { ...serializeRoutine(routine), studentIds: [studentId], students: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }], historicalStudents: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }] } : null;
    const data: PortalData = {
      exerciseMediaEnabled: await exerciseMediaAvailable(),
      profile: { id: studentId, firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: student.email, birthDate: student.birthDate, goal: student.goal, plan: student.plan, joinedAt: student.joinedAt, status: student.status, serviceType, dueDate: student.dueDate, scheduleLabels: studentSchedules.map((assignment) => weeklyScheduleLabel(assignment.schedule)), flexibleSchedule: groupClassesEnabled ? student.flexibleSchedule ?? "" : "", profileImageUrl: student.profileImageUrl ?? "" },
      routine: privateRoutine,
      evaluations: normalizedEvaluations.map((evaluation) => ({ ...toStudentEvaluation(evaluation), notes: "", frontPhotoUrl: "", sidePhotoUrl: "", backPhotoUrl: "" })),
      payments: payments.map(serializePayment),
      paymentAccount: portalPaymentAccount(student, payments, todayKey),
      paymentMethods: settings?.paymentMethods?.filter((method) => method.trim().length > 0) ?? [],
      paymentObligations,
      transferDetails: normalizeTransferDetails(settings?.transferDetails),
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
        blocks: [...workout.blocks].sort((left, right) => left.blockOrder - right.blockOrder).map((log) => ({
          id: log.id,
          blockId: log.blockReferenceId,
          blockName: log.blockName,
          blockType: log.blockType,
          blockOrder: log.blockOrder,
          configuration: log.blockConfiguration as Record<string, number | string | null>,
          exercises: log.exercisesSnapshot as Array<{ exerciseId: string; name: string; targetType: string; targetLabel: string; order: number }>,
          result: log.result as unknown as import("@/types/portal").PortalWorkoutBlockResult,
        })),
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
        mode: serviceType === "MIXED" ? "MIXTO" : serviceType === "PERSONALIZED" ? "RUTINA_PERSONALIZADA" : "PRESENCIAL",
        hasClassParticipation: homeInsights.hasClassParticipation,
        classesAttendedThisMonth: homeInsights.classesAttendedThisMonth,
        monthlyAttendancePercentage: homeInsights.monthlyAttendancePercentage,
        classesAttendedPreviousMonth: homeInsights.classesAttendedPreviousMonth,
        previousMonthAttendancePercentage: homeInsights.previousMonthAttendancePercentage,
        coachPhone: settings?.phone ?? "",
        achievements: homeInsights.achievements,
        points: homeInsights.points,
        weeklyMission: homeInsights.weeklyMission,
      },
    };
    if (section === "inicio" || section === "puntos" || section === "puntos-historial") data.weeklyWorkouts = homeInsights.weeklyWorkoutCount;
    return Response.json(data);
  } catch (error) {
    console.error("Error al cargar datos del portal", error);
    return Response.json({ error: "No se pudo cargar tu información desde Neon." }, { status: 500 });
  }
}
