import "server-only";

import type {
  StudentPointEventType,
  StudentPointSourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { loadNotifiableAchievements } from "@/lib/notifiable-achievements";
import {
  dispatchTrainerPush,
  TRAINER_OWNER_KEY,
} from "@/lib/trainer-notifications";
import { sendStudentPush } from "@/lib/push-notifications";
import type {
  StudentPointMovement,
  StudentPointSummary,
} from "@/types/points";

export const POINT_RULES = {
  ATTENDANCE: 5,
  RECORD: 3,
  PERSONAL_RECORD: 10,
  ACHIEVEMENT: 15,
  MILESTONE: 20,
} as const;

type PointEvent = {
  eventKey: string;
  eventType: StudentPointEventType;
  sourceType: StudentPointSourceType;
  sourceId: string | null;
  points: number;
  description: string;
  occurredAt: Date;
};

function dateAtNoon(value: Date | string) {
  const key =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  return new Date(`${key}T12:00:00.000Z`);
}

function isImportantMilestone(id: string, level?: string) {
  return (
    level === "ESPECIAL" ||
    level === "HITO" ||
    /^classes-(10|25|50|100|200)$/.test(id) ||
    /^workouts-(10|25|50)$/.test(id) ||
    /^quick-log:milestone:(10|25|50|100)$/.test(id)
  );
}

function isPersonalRecord(id: string) {
  return (
    id.startsWith("performance-") ||
    id.includes(":max:") ||
    id.includes(":repetitions:")
  );
}

async function desiredPointEvents(studentId: string): Promise<PointEvent[]> {
  const [
    occurrenceAttendances,
    legacyAttendances,
    quickLogs,
    classWorkoutLogs,
    workoutSessions,
    achievements,
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
      prisma.classWorkoutLog.findMany({
        where: { studentId, status: "COMPLETED" },
        select: {
          id: true,
          classNameSnapshot: true,
          classDateSnapshot: true,
          completedAt: true,
          createdAt: true,
          exercises: { select: { id: true }, take: 1 },
        },
      }),
      prisma.workoutSession.findMany({
        where: { studentId, status: "COMPLETED" },
        select: {
          id: true,
          routineNameSnapshot: true,
          date: true,
          createdAt: true,
          exercises: { select: { id: true }, take: 1 },
        },
      }),
      loadNotifiableAchievements(studentId, { includeAll: true }),
    ]);

  const events: PointEvent[] = [];
  const firstOccurrenceDate =
    occurrenceAttendances[0]?.occurrence.date.toISOString().slice(0, 10) ?? "";

  for (const attendance of legacyAttendances) {
    const dateKey = attendance.date.toISOString().slice(0, 10);
    if (firstOccurrenceDate && dateKey >= firstOccurrenceDate) continue;
    events.push({
      eventKey: `attendance:legacy:${attendance.id}`,
      eventType: "ATTENDANCE",
      sourceType: "LEGACY_ATTENDANCE",
      sourceId: attendance.id,
      points: POINT_RULES.ATTENDANCE,
      description: `Asistencia cumplida a ${attendance.scheduleLabel || "clase presencial"}`,
      occurredAt: attendance.date,
    });
  }

  for (const attendance of occurrenceAttendances) {
    events.push({
      eventKey: `attendance:occurrence:${attendance.id}`,
      eventType: "ATTENDANCE",
      sourceType: "CLASS_OCCURRENCE_ATTENDANCE",
      sourceId: attendance.id,
      points: POINT_RULES.ATTENDANCE,
      description: `Asistencia cumplida a ${attendance.occurrence.classNameSnapshot}`,
      occurredAt:
        attendance.checkedInAt ??
        dateAtNoon(attendance.occurrence.date),
    });
  }

  for (const log of quickLogs) {
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
    events.push({
      eventKey: `record:quick-log:${log.id}`,
      eventType: "RECORD",
      sourceType: "QUICK_LOG",
      sourceId: log.id,
      points: POINT_RULES.RECORD,
      description: `Registro cargado: ${detail}`,
      occurredAt: log.createdAt,
    });
  }

  for (const log of classWorkoutLogs) {
    if (!log.exercises.length) continue;
    events.push({
      eventKey: `record:class-workout:${log.id}`,
      eventType: "RECORD",
      sourceType: "CLASS_WORKOUT_LOG",
      sourceId: log.id,
      points: POINT_RULES.RECORD,
      description: `Registro cargado en ${log.classNameSnapshot}`,
      occurredAt:
        log.completedAt ?? dateAtNoon(log.classDateSnapshot),
    });
  }

  for (const session of workoutSessions) {
    if (!session.exercises.length) continue;
    events.push({
      eventKey: `record:workout-session:${session.id}`,
      eventType: "RECORD",
      sourceType: "WORKOUT_SESSION",
      sourceId: session.id,
      points: POINT_RULES.RECORD,
      description: `Entrenamiento finalizado: ${session.routineNameSnapshot || "rutina personalizada"}`,
      occurredAt: dateAtNoon(session.date),
    });
  }

  for (const achievement of achievements) {
    const important = isImportantMilestone(
      achievement.id,
      achievement.level,
    );
    events.push({
      eventKey: `achievement:${achievement.id}`,
      eventType: important ? "MILESTONE" : "ACHIEVEMENT",
      sourceType: "ACHIEVEMENT",
      sourceId: achievement.id,
      points: important
        ? POINT_RULES.MILESTONE
        : POINT_RULES.ACHIEVEMENT,
      description: `Logro desbloqueado: ${achievement.name}`,
      occurredAt: dateAtNoon(achievement.unlockedAt),
    });
    if (isPersonalRecord(achievement.id)) {
      events.push({
        eventKey: `personal-record:${achievement.id}`,
        eventType: "PERSONAL_RECORD",
        sourceType: "ACHIEVEMENT",
        sourceId: achievement.id,
        points: POINT_RULES.PERSONAL_RECORD,
        description: `Nueva marca${achievement.exercise ? ` en ${achievement.exercise}` : ""}`,
        occurredAt: dateAtNoon(achievement.unlockedAt),
      });
    }
  }

  return events;
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

  const relevant = gained.filter(
    (item) =>
      item.eventType === "PERSONAL_RECORD" ||
      item.eventType === "ACHIEVEMENT" ||
      item.eventType === "MILESTONE",
  );
  if (!relevant.length) return;
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { data: true },
  });
  if (!student) return;
  const latestRelevant = relevant.at(-1)!;
  const message = `${studentName(student.data)} sumó +${latestRelevant.points} pts por ${latestRelevant.description.toLocaleLowerCase("es")}. Total: ${total} pts.`;
  const eventKey = `points:${studentId}:${latestRelevant.eventKey}`;
  const notification = await prisma.trainerNotification
    .create({
      data: {
        ownerKey: TRAINER_OWNER_KEY,
        type: "POINTS",
        eventKey,
        title: "Progreso destacado",
        message,
        url: `/alumnos?studentId=${encodeURIComponent(studentId)}`,
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
  await dispatchTrainerPush(notification.id, {
    title: "BM Training",
    body: message,
    url: notification.url,
    tag: `points-${studentId}`,
  }).catch((error) => {
    console.error("No se pudo enviar el avance por push", error);
  });
}

export async function syncStudentPoints(
  studentId: string,
  options: { notify?: boolean } = {},
) {
  const desired = await desiredPointEvents(studentId);
  const desiredByKey = new Map(desired.map((item) => [item.eventKey, item]));
  const previous = await prisma.studentPointTransaction.findMany({
    where: { studentId },
    select: { eventKey: true, active: true },
  });
  const previouslyActive = new Set(
    previous.filter((item) => item.active).map((item) => item.eventKey),
  );
  const gained = desired.filter((item) => !previouslyActive.has(item.eventKey));
  const now = new Date();

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
      }
      const obsoleteKeys = previous
        .filter(
          (item) => item.active && !desiredByKey.has(item.eventKey),
        )
        .map((item) => item.eventKey);
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
  return { total, gained };
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
  await syncStudentPoints(studentId).catch((error) => {
    console.error("No se pudieron recalcular los puntos del alumno", {
      studentId,
      error,
    });
  });
}
