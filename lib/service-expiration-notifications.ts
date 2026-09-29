import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey } from "@/lib/payment-dates";
import { sendStudentNativePush } from "@/lib/native-push-notifications";
import {
  serviceExpirationCandidate,
  type ServiceExpirationReminderKind,
} from "@/lib/service-expiration-rules";
import type { Student } from "@/types/gestion";

const SERVICE_PORTAL_URL = "/portal/pagos";

function storedStudent(value: Prisma.JsonValue) {
  return value as unknown as Partial<Student>;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type CreatedServiceExpirationReminder = {
  studentId: string;
  dueDate: string;
  kind: ServiceExpirationReminderKind;
  eventKey: string;
  title: string;
  message: string;
};

export async function createServiceExpirationReminders(
  today = argentinaDateKey(),
) {
  const records = await prisma.studentRecord.findMany({
    where: {
      nativePushDevices: {
        some: { active: true, platform: "ANDROID" },
      },
    },
    select: {
      id: true,
      data: true,
      nativePushDevices: {
        where: { active: true, platform: "ANDROID" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { id: "asc" },
  });
  const created: CreatedServiceExpirationReminder[] = [];
  for (const record of records) {
    const student = storedStudent(record.data);
    const candidate = serviceExpirationCandidate({
      studentId: record.id,
      status: student.status,
      dueDate: student.dueDate,
      hasNativePushDevice: record.nativePushDevices.length > 0,
      today,
    });
    if (!candidate) continue;
    try {
      await prisma.studentNotification.create({
        data: {
          studentId: candidate.studentId,
          type: "REMINDER",
          eventKey: candidate.eventKey,
          title: candidate.title,
          message: candidate.message,
          url: SERVICE_PORTAL_URL,
        },
      });
      created.push(candidate);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
  }
  return created;
}

export async function sendServiceExpirationReminder(
  reminder: CreatedServiceExpirationReminder,
  today = argentinaDateKey(),
) {
  const record = await prisma.studentRecord.findFirst({
    where: {
      id: reminder.studentId,
      nativePushDevices: {
        some: { active: true, platform: "ANDROID" },
      },
    },
    select: { id: true, data: true },
  });
  if (!record) return false;
  const student = storedStudent(record.data);
  const current = serviceExpirationCandidate({
    studentId: record.id,
    status: student.status,
    dueDate: student.dueDate,
    hasNativePushDevice: true,
    today,
  });
  if (!current || current.eventKey !== reminder.eventKey) return false;
  await sendStudentNativePush(reminder.studentId, {
    title: reminder.title,
    body: reminder.message,
    url: SERVICE_PORTAL_URL,
    tag: reminder.eventKey,
  });
  return true;
}
