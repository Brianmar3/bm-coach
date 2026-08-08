import "server-only";

import type {
  StudentPointEventType,
  StudentPointSourceType,
} from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import {
  buildValidPointEvents,
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
import { resolveCurrentWeeklyMission } from "@/lib/weekly-mission-data";

type PointEvent = ValidPointEvent;

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
        where: { studentId, state: "COMPLETED" },
        select: { id: true, weekStart: true },
        orderBy: { weekStart: "asc" },
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
    weeklyMissions: completedWeeklyMissions.map((mission) => ({
      id: mission.id,
      date: mission.weekStart,
      description: "Misión semanal completada",
    })),
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
    title: `+${gainedTotal} puntos en BM Training`,
    body:
      gained.length === 1
        ? latest.description
        : `Sumaste puntos por ${gained.length} avances registrados.`,
    url: "/portal#puntos",
    tag: `student-points-${studentId}`,
  }).catch((error) => {
    console.error("No se pudo enviar el puntaje por push", error);
  });

  const relevant: PointEvent[] = [];
  if (!relevant.length) return;
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { data: true },
  });
  if (!student) return;
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
    title: "BM Training",
    body: message,
    url: notification.url,
    tag: `points-${studentId}`,
  }).catch((error) => {
    console.error("No se pudo enviar el avance por push", error);
  }));
}

export async function syncStudentPoints(
  studentId: string,
  options: { notify?: boolean; cleanupHistoricalMarks?: boolean } = {},
) {
  await resolveCurrentWeeklyMission(studentId);
  const desired = await desiredPointEvents(studentId);
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
        if (event.sourceType === "WEEKLY_MISSION") {
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
    routineSessions: desired.filter((event) => event.sourceType === "WORKOUT_SESSION").length,
    attendances: desired.filter((event) => event.eventType === "ATTENDANCE").length,
    achievements: 0,
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
): Promise<StudentPointSummary> {
  const { total } = await syncStudentPoints(studentId, { notify: false });
  const recent = await prisma.studentPointTransaction.findMany({
    where: { studentId, active: true },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
  const nextTarget = Math.max(50, Math.ceil((total + 1) / 50) * 50);
  return {
    total,
    latest: recent[0] ? movement(recent[0]) : null,
    recent: recent.map(movement),
    nextTarget,
    pointsToNextTarget: Math.max(0, nextTarget - total),
  };
}

export async function reconcileStudentPointsAfterMutation(studentId: string) {
  return syncStudentPoints(studentId).catch((error) => {
    console.error("No se pudieron recalcular los puntos del alumno", {
      studentId,
      error,
    });
    return null;
  });
}
