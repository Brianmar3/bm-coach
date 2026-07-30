import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import {
  buildAttendanceMessage,
  buildAttendanceUrl,
  TRAINER_OWNER_KEY,
} from "@/lib/trainer-notifications";
import { databaseDateKey } from "@/lib/payment-dates";
import { occurrenceClassName } from "@/lib/class-occurrences";
import type { Student } from "@/types/gestion";

async function isAuthenticatedTrainer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionValue(token).ok;
}

export async function GET() {
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.trainerNotification.findMany({
      where: { ownerKey: TRAINER_OWNER_KEY },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        url: true,
        studentId: true,
        student: {
          select: {
            data: true,
          },
        },
        occurrenceId: true,
        occurrence: {
          select: {
            date: true,
            startTime: true,
            status: true,
            classNameSnapshot: true,
            categorySnapshot: true,
            scheduleId: true,
            schedule: {
              select: {
                classType: true,
              },
            },
          },
        },
        response: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.trainerNotification.count({
      where: {
        ownerKey: TRAINER_OWNER_KEY,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(({ occurrence, student, ...notification }) => {
      const attendanceContext =
        notification.type === "CLASS_RESPONSE" &&
        occurrence &&
        notification.response
          ? {
              classDateKey: databaseDateKey(occurrence.date),
              className: occurrenceClassName(occurrence),
              studentName: student
                ? [
                    (student.data as unknown as Partial<Student>).firstName,
                    (student.data as unknown as Partial<Student>).lastName,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "Alumno"
                : "Alumno",
            }
          : null;
      return {
        ...notification,
        message: attendanceContext
          ? buildAttendanceMessage({
              ...attendanceContext,
              startTime: occurrence!.startTime,
              response: notification.response!,
            })
          : notification.message,
        url:
          attendanceContext
            ? buildAttendanceUrl({
                classDateKey: attendanceContext.classDateKey,
                scheduleId: occurrence!.scheduleId,
                studentId: notification.studentId,
                occurrenceId: notification.occurrenceId,
              })
            : notification.url,
      };
    }),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; all?: unknown }
    | null;

  if (body?.all === true) {
    await prisma.trainerNotification.updateMany({
      where: {
        ownerKey: TRAINER_OWNER_KEY,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json(
      { error: "Falta la notificación." },
      { status: 400 },
    );
  }

  const result = await prisma.trainerNotification.updateMany({
    where: {
      id,
      ownerKey: TRAINER_OWNER_KEY,
    },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "No se encontró la notificación." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
