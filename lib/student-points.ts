import "server-only";

import type {
  StudentPointEventType,
  StudentPointSourceType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { argentinaDateKey, argentinaDateTimeBoundary, argentinaMonthBounds, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeSportsPointStart, buildSportsPointEvents } from "@/lib/sports-point-policy";
import { loadSportsActivity } from "@/lib/sports-point-data";
import { loadNotifiableAchievements } from "@/lib/notifiable-achievements";
import { studentName } from "@/lib/attendance";
import {
  buildValidPointEvents,
  effectivePointDate,
  pointEventKeysToInvalidate,
  type ValidPointEvent,
} from "@/lib/point-event-rules";
import {
  dispatchTrainerPush,
  TRAINER_OWNER_KEY,
} from "@/lib/trainer-notifications";
import { sendStudentPush } from "@/lib/push-notifications";
import { resolveTrainerNotificationDestination } from "@/lib/trainer-notification-destination";
import type {
  StudentPointMovement,
  StudentPointSummary,
} from "@/types/points";
import { reconcileWeeklyMissionForDate, resolveCurrentWeeklyMission } from "@/lib/weekly-mission-data";
import { paymentWasOnTime } from "@/lib/payment-notification-rules";
import { weekRange } from "@/lib/weekly-attendance";
import { pointPeriodStart } from "@/lib/point-period";
import { isCompetitiveGamificationEligible, wasCompetitiveDuringMembership } from "@/lib/student-service";
import { reconcileInformativeQuickLogPoints } from "@/lib/quick-log-point-reconciliation";

type PointEvent = ValidPointEvent;

type CompetitiveMembershipPeriod = {
  startDate: Date;
  endDate: Date | null;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
};

export function pointEventWasCompetitivelyEligible(eventDate: Date, periods: CompetitiveMembershipPeriod[]) {
  return wasCompetitiveDuringMembership(eventDate, periods);
}

function isIndividualExercisePointEvent(item: {
  eventKey: string;
  sourceType: StudentPointSourceType;
  sourceId: string | null;
}) {
  return (
    item.eventKey.startsWith("record:class-exercise:") ||
    item.eventKey.startsWith("record:workout-exercise:") ||
    item.eventKey.startsWith("record:routine-exercise:") ||
    item.eventKey.includes("performance-routine-") ||
    item.eventKey.includes("performance-class-") ||
    item.sourceId?.startsWith("performance-routine-") === true ||
    item.sourceId?.startsWith("performance-class-") === true
  );
}

async function desiredPointEvents(studentId: string): Promise<PointEvent[]> {
  const [
    occurrenceAttendances,
    legacyAttendances,
    quickLogs,
    completedRoutineSessions,
    completedWeeklyMissions,
    payments,
  ] =
    await Promise.all([
      prisma.classOccurrenceAttendance.findMany({
        where: {
          studentId,
          actualAttendance: "PRESENT",
          occurrence: { status: { not: "CANCELLED" } },
        },
        select: {
          id: true,
          checkedInAt: true,
          updatedAt: true,
          occurrence: {
            select: {
              date: true,
              classNameSnapshot: true,
            },
          },
        },
        orderBy: { occurrence: { date: "asc" } },
      }),
      prisma.classAttendance.findMany({
        where: { studentId, status: "PRESENT" },
        select: {
          id: true,
          date: true,
          scheduleLabel: true,
          updatedAt: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.quickLog.findMany({
        where: { studentId },
        select: {
          id: true,
          type: true,
          exerciseName: true,
          sets: true,
          repetitions: true,
          currentValue: true,
          previousValue: true,
          metricType: true,
          durationMinutes: true,
          unit: true,
          date: true,
          createdAt: true,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.workoutSession.findMany({
        where: { studentId, status: "COMPLETED" },
        select: {
          id: true,
          routineNameSnapshot: true,
          date: true,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.studentWeeklyMission.findMany({
        where: { studentId, progress: { gt: 0 } },
        select: { id: true, weekStart: true, weekEnd: true, progress: true, target: true, rewardPoints: true },
        orderBy: { weekStart: "asc" },
      }),
      prisma.studentPayment.findMany({
        where: { studentId, status: "PAGADO", paidDate: { not: null } },
        select: { id: true, paidDate: true, dueDate: true },
        orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  const firstOccurrenceDate =
    occurrenceAttendances[0]?.occurrence.date.toISOString().slice(0, 10) ?? "";
  const quickLogEvents = quickLogs.map((log) => {
    const detail =
      log.exerciseName &&
      log.sets !== null &&
      log.repetitions !== null &&
      log.currentValue !== null
        ? `${log.exerciseName} ${log.sets}×${log.repetitions} con ${Number(log.currentValue).toLocaleString("es-AR")} ${log.unit || "kg"}`
        : log.type === "WORKOUT"
          ? "entrenamiento personal"
          : log.type === "PHOTO"
            ? "registro con foto"
            : log.type === "NOTE"
              ? "nota personal"
              : "progreso personal";
    return {
      ...log,
      currentValue: log.currentValue === null ? null : Number(log.currentValue),
      previousValue: log.previousValue === null ? null : Number(log.previousValue),
      id: log.id,
      date: log.date,
      description: `Registro cargado: ${detail}`,
    };
  });
  return buildValidPointEvents({
    legacyAttendances: legacyAttendances
      .filter((attendance) => !firstOccurrenceDate || attendance.date.toISOString().slice(0, 10) < firstOccurrenceDate)
      .map((attendance) => ({
        id: attendance.id,
        date: attendance.date,
        description: `Asistencia cumplida a ${attendance.scheduleLabel || "clase presencial"}`,
      })),
    occurrenceAttendances: occurrenceAttendances.map((attendance) => ({
      id: attendance.id,
      date: attendance.occurrence.date,
      description: `Asistencia cumplida a ${attendance.occurrence.classNameSnapshot}`,
    })),
    quickLogs: quickLogEvents,
    completedRoutineSessions: completedRoutineSessions.map((session) => ({
      id: session.id,
      date: session.date,
      description: `Rutina completada: ${session.routineNameSnapshot || "entrenamiento personalizado"}`,
    })),
    weeklyMissions: completedWeeklyMissions.map((mission) => {
      const start = mission.weekStart.toISOString().slice(0, 10);
      const end = mission.weekEnd.toISOString().slice(0, 10);
      const byDate = new Map<string, { id: string; date: Date }>();
      for (const attendance of occurrenceAttendances) {
        const key = attendance.occurrence.date.toISOString().slice(0, 10);
        if (key >= start && key <= end && !byDate.has(key)) byDate.set(key, { id: `occurrence-${attendance.id}`, date: attendance.occurrence.date });
      }
      for (const attendance of legacyAttendances) {
        const key = attendance.date.toISOString().slice(0, 10);
        if (key >= start && key <= end && !byDate.has(key)) byDate.set(key, { id: `legacy-${attendance.id}`, date: attendance.date });
      }
      return {
      id: mission.id,
      date: mission.weekStart,
      description: "Misión semanal completada",
      progress: mission.progress,
      target: mission.target,
      rewardPoints: mission.rewardPoints,
      sessions: [...byDate.values()].sort((left, right) => left.date.getTime() - right.date.getTime()),
    }; }),
    onTimePayments: payments.flatMap((payment) =>
      payment.paidDate && paymentWasOnTime(payment.paidDate, payment.dueDate)
        ? [{ id: payment.id, date: payment.paidDate, description: "Pago de cuota registrado en término" }]
        : [],
    ),
  });
}

function movement(item: {
  id: string;
  eventType: StudentPointEventType;
  points: number;
  description: string;
  occurredAt: Date;
}): StudentPointMovement {
  return {
    id: item.id,
    eventType: item.eventType,
    points: item.points,
    description: item.description,
    occurredAt: item.occurredAt.toISOString(),
  };
}

async function notifyPointGain(
  studentId: string,
  gained: PointEvent[],
  total: number,
) {
  if (!gained.length) return;
  const gainedTotal = gained.reduce((sum, item) => sum + item.points, 0);
  const latest = gained.at(-1)!;
  await prisma.studentNotification.create({
    data: {
      studentId,
      type: "POINTS",
      title: `+${gainedTotal} puntos`,
      message:
        gained.length === 1
          ? latest.description
          : `Sumaste puntos por ${gained.length} avances registrados.`,
      url: "/portal#puntos",
    },
  });
  await sendStudentPush(studentId, {
    title: `+${gainedTotal} puntos`,
    body:
      gained.length === 1
        ? latest.description
        : `Sumaste puntos por ${gained.length} avances registrados.`,
    url: "/portal#puntos",
    tag: `student-points-${studentId}`,
    type: "POINTS",
  }).catch((error) => {
    console.error("No se pudo enviar el puntaje por push", error);
  });

  const relevant: PointEvent[] = [];
  if (!relevant.length) return;
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { data: true, workspaceId: true },
  });
  if (!student?.workspaceId) return;
  const workspaceId = student.workspaceId;
  const latestRelevant = relevant.at(-1)!;
  const message = `${studentName(student.data)} sumó +${latestRelevant.points} pts por ${latestRelevant.description.toLocaleLowerCase("es")}. Total: ${total} pts.`;
  const eventKey = `points:${studentId}:${latestRelevant.eventKey}`;
  const notificationUrl = resolveTrainerNotificationDestination({
    type: "POINTS",
    studentId,
    eventKey,
  });
  const notification = await prisma.trainerNotification
    .create({
      data: {
        workspaceId,
        ownerKey: TRAINER_OWNER_KEY,
        type: "POINTS",
        eventKey,
        title: "Progreso destacado",
        message,
        url: notificationUrl,
        studentId,
        response: null,
      },
    })
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return null;
      }
      console.error("No se pudo notificar el avance al entrenador", error);
      return null;
    });
  if (!notification) return;
  after(() => dispatchTrainerPush(notification.id, {
    title: "Progreso destacado",
    body: message,
    url: notification.url,
    tag: `points-${studentId}`,
  }, workspaceId).catch((error) => {
    console.error("No se pudo enviar el avance por push", error);
  }));
}


async function syncSportsStudentPoints(studentId: string, start: string, options: { notify?: boolean }) {
  const today = argentinaDateKey();
  const boundary = argentinaDateTimeBoundary(start);
  const result = await prisma.$transaction(async db => {
    await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"sports-points:" + studentId})::bigint)`);
    const { days, contracts, serviceType } = await loadSportsActivity(studentId, start, today, db);
    const achievements = await loadNotifiableAchievements(studentId, { verifiedAttendance: true, db });
    const milestones = achievements.filter(item => item.level === "DESTACADO" || item.level === "ESPECIAL" ||
      item.level === "HITO" || item.category === "RECORDS_PERSONALES");
    const events = buildSportsPointEvents({ start, today, days, contracts,
      achievements: milestones.map(item => ({ id: item.id, date: item.unlockedAt, name: item.name })) });
    const payments = await db.studentPayment.findMany({
      where: { studentId, status: "PAGADO", amount: { gt: 0 }, paidDate: { gte: new Date(start), lt: new Date(new Date(today).getTime() + 86400000) } },
      select: { id: true, paidDate: true, dueDate: true },
    });
    const paymentPeriods = contracts.map(period => ({
      startDate: dateKeyToDatabase(period.start),
      endDate: period.end ? dateKeyToDatabase(period.end) : null,
      serviceType: period.serviceType,
    }));
    events.push(...buildValidPointEvents({ onTimePayments: payments.flatMap(payment => {
      if (!payment.paidDate || !paymentWasOnTime(payment.paidDate, payment.dueDate)) return [];
      const date = effectivePointDate(payment.paidDate);
      const eligible = paymentPeriods.length
        ? wasCompetitiveDuringMembership(date, paymentPeriods)
        : serviceType && isCompetitiveGamificationEligible(serviceType);
      return eligible ? [{ id: payment.id, date, description: "Pago de cuota registrado en término" }] : [];
    }) }));
    const previous = await db.studentPointTransaction.findMany({ where: { studentId },
      select: { eventKey: true, active: true, occurredAt: true, notifiedAt: true } });
    const beforeCutoff = (row: typeof previous[number]) => row.eventKey.startsWith("payment-on-time:")
      ? databaseDateKey(row.occurredAt) < start : row.occurredAt < boundary;
    const byKey = new Map(previous.map(row => [row.eventKey, row]));
    const desired = new Set(events.map(event => event.eventKey));
    const gained: PointEvent[] = [];
    const now = new Date();
    const historicalBonus = previous.find(row => row.active && row.occurredAt < boundary &&
      (row.eventKey.startsWith("weekly-mission-bonus:") || row.eventKey.startsWith("weekly-mission:")) &&
      argentinaDateKey(row.occurredAt) >= (weekRange(start)?.start ?? start));
    for (const event of events) {
      if (historicalBonus && event.eventKey === "sports:weekly:" + weekRange(start)?.start) continue;
      const row = byKey.get(event.eventKey);
      if (row && beforeCutoff(row)) continue;
      const claim = !row?.notifiedAt;
      await db.studentPointTransaction.upsert({
        where: { studentId_eventKey: { studentId, eventKey: event.eventKey } },
        create: { studentId, ...event, notifiedAt: now },
        update: { ...event, active: true, invalidatedAt: null, notifiedAt: row?.notifiedAt ?? now },
      });
      if (claim && options.notify !== false) gained.push(event);
    }
    const obsolete = previous.filter(row => row.active && !beforeCutoff(row) && !desired.has(row.eventKey));
    const invalidated = obsolete.length ? await db.studentPointTransaction.updateMany({
      where: { studentId, eventKey: { in: obsolete.map(row => row.eventKey) },
        OR: [{ occurredAt: { gte: boundary } }, { sourceType: "PAYMENT", occurredAt: { gte: new Date(start) } }] },
      data: { active: false, invalidatedAt: now },
    }) : { count: 0 };
    const { _sum } = await db.studentPointTransaction.aggregate({ where: { studentId, active: true }, _sum: { points: true } });
    const sourceCounts = { quickLogs: 0,
      routineSessions: events.filter(event => event.eventKey.startsWith("sports:training:") && event.sourceType === "WORKOUT_SESSION").length,
      attendances: events.filter(event => event.eventType === "ATTENDANCE").length,
      achievements: events.filter(event => event.eventType === "ACHIEVEMENT").length };
    return { total: _sum.points ?? 0, gained, desiredCount: events.length, sourceCounts,
      individualExerciseEventsRemoved: 0, eventsInvalidated: invalidated.count,
      activityEventCount: sourceCounts.routineSessions + sourceCounts.attendances + sourceCounts.achievements };
  });
  await notifyPointGain(studentId, result.gained, result.total).catch(error =>
    console.error("No se pudo notificar el movimiento de puntos", { studentId, error }));
  return result;
}

export async function syncStudentPoints(
  studentId: string,
  options: { notify?: boolean; cleanupHistoricalMarks?: boolean; attendanceDate?: string } = {},
) {
  const sportsStart = activeSportsPointStart();
  if (sportsStart) return syncSportsStudentPoints(studentId, sportsStart, options);
  await reconcileInformativeQuickLogPoints([studentId]);
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { serviceType: true },
  });
  if (!student || !isCompetitiveGamificationEligible(student.serviceType)) {
    const historical = await prisma.studentPointTransaction.aggregate({
      where: { studentId, active: true },
      _sum: { points: true },
    });
    return {
      total: historical._sum.points ?? 0,
      gained: [] as PointEvent[],
      desiredCount: 0,
      sourceCounts: { quickLogs: 0, routineSessions: 0, attendances: 0, achievements: 0 },
      individualExerciseEventsRemoved: 0,
      eventsInvalidated: 0,
      activityEventCount: 0,
    };
  }
  if (options.attendanceDate) await reconcileWeeklyMissionForDate(studentId, options.attendanceDate);
  else await resolveCurrentWeeklyMission(studentId);
  const periods = await prisma.studentMembershipHistory.findMany({
    where: { studentId },
    select: { startDate: true, endDate: true, serviceType: true },
    orderBy: { startDate: "asc" },
  });
  const desired = (await desiredPointEvents(studentId)).filter((event) => pointEventWasCompetitivelyEligible(event.occurredAt, periods));
  const previous = await prisma.studentPointTransaction.findMany({
    where: { studentId },
    select: { eventKey: true, active: true, sourceType: true, sourceId: true },
  });
  const previouslyActive = new Set(
    previous.filter((item) => item.active).map((item) => item.eventKey),
  );
  const gained = desired.filter((item) => !previouslyActive.has(item.eventKey));
  const now = new Date();
  let individualExerciseEventsRemoved = 0;
  let eventsInvalidated = 0;

  await prisma.$transaction(
    async (transaction) => {
      for (const event of desired) {
        await transaction.studentPointTransaction.upsert({
          where: {
            studentId_eventKey: {
              studentId,
              eventKey: event.eventKey,
            },
          },
          create: { studentId, ...event },
          update: {
            eventType: event.eventType,
            sourceType: event.sourceType,
            sourceId: event.sourceId,
            points: event.points,
            description: event.description,
            occurredAt: event.occurredAt,
            active: true,
            invalidatedAt: null,
          },
        });
        if (event.eventKey.startsWith("weekly-mission-bonus:")) {
          await transaction.studentWeeklyMission.updateMany({
            where: { id: event.sourceId, studentId, pointsAwardedAt: null },
            data: { pointsAwardedAt: now },
          });
        }
      }
      const invalidCandidates = pointEventKeysToInvalidate(previous, desired);
      const obsoleteKeys = previous
        .filter((item) => invalidCandidates.includes(item.eventKey))
        .filter((item) =>
          item.sourceType === "ACHIEVEMENT" ||
          (options.cleanupHistoricalMarks === true && isIndividualExercisePointEvent(item)) ||
          (!isIndividualExercisePointEvent(item) &&
            item.sourceType !== "CLASS_WORKOUT_LOG" &&
            item.sourceId !== "first-strength-log" &&
            !item.sourceId?.includes(":class:")),
        )
        .map((item) => item.eventKey);
      individualExerciseEventsRemoved = previous.filter(
        (item) =>
          obsoleteKeys.includes(item.eventKey) &&
          isIndividualExercisePointEvent(item),
      ).length;
      eventsInvalidated = obsoleteKeys.length;
      if (obsoleteKeys.length) {
        await transaction.studentPointTransaction.updateMany({
          where: { studentId, eventKey: { in: obsoleteKeys } },
          data: { active: false, invalidatedAt: now },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );

  const aggregate = await prisma.studentPointTransaction.aggregate({
    where: { studentId, active: true },
    _sum: { points: true },
  });
  const total = aggregate._sum.points ?? 0;
  if (options.notify === false) {
    await prisma.studentPointTransaction.updateMany({
      where: { studentId, active: true, notifiedAt: null },
      data: { notifiedAt: now },
    });
  } else {
    const claimed: PointEvent[] = [];
    for (const event of gained) {
      const result = await prisma.studentPointTransaction.updateMany({
        where: {
          studentId,
          eventKey: event.eventKey,
          active: true,
          notifiedAt: null,
        },
        data: { notifiedAt: now },
      });
      if (result.count) claimed.push(event);
    }
    await notifyPointGain(studentId, claimed, total).catch((error) => {
      console.error("No se pudo notificar el movimiento de puntos", error);
    });
  }
  const sourceCounts = {
    quickLogs: desired.filter((event) => event.eventKey.startsWith("record:quick-log:")).length,
    routineSessions: desired.filter((event) => event.eventKey.startsWith("record:workout-session:")).length,
    attendances: desired.filter((event) => event.eventType === "ATTENDANCE").length,
    achievements: desired.filter(event => event.eventType === "ACHIEVEMENT").length,
  };
  return {
    total,
    gained,
    desiredCount: desired.length,
    sourceCounts,
    individualExerciseEventsRemoved,
    eventsInvalidated,
    activityEventCount: sourceCounts.quickLogs + sourceCounts.routineSessions + sourceCounts.attendances + sourceCounts.achievements,
  };
}

export async function loadStudentPointSummary(
  studentId: string,
  recentLimit = 8,
): Promise<StudentPointSummary> {
  const { total } = await syncStudentPoints(studentId, { notify: false });
  const [recent, monthly] = await Promise.all([
    prisma.studentPointTransaction.findMany({
      where: { studentId, active: true },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: recentLimit,
    }),
    prisma.studentPointTransaction.aggregate({
      where: { studentId, active: true, occurredAt: { gte: pointPeriodStart("month")!, lt: argentinaDateTimeBoundary(argentinaMonthBounds().nextMonthStart) } },
      _sum: { points: true },
    }),
  ]);
  const nextTarget = Math.max(50, Math.ceil((total + 1) / 50) * 50);
  return {
    total,
    monthlyTotal: monthly._sum.points ?? 0,
    latest: recent[0] ? movement(recent[0]) : null,
    recent: recent.map(movement),
    nextTarget,
    pointsToNextTarget: Math.max(0, nextTarget - total),
  };
}

export async function reconcileStudentPointsAfterMutation(studentId: string, attendanceDate?: string) {
  return syncStudentPoints(studentId, { attendanceDate }).catch((error) => {
    console.error("No se pudieron recalcular los puntos del alumno", {
      studentId,
      error,
    });
    return null;
  });
}
