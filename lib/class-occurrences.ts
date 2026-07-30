import "server-only";

import type { ClassWeekday, Prisma, PrismaClient } from "@prisma/client";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

type OccurrenceClassSource = {
  date: Date;
  status: string;
  classNameSnapshot: string;
  categorySnapshot?: string;
  schedule?: { classType: string } | null;
};

const weekdayNumber: Record<ClassWeekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
};

export function addDateKeyDays(value: string, days: number) {
  const date = dateKeyToDatabase(value);
  date.setUTCDate(date.getUTCDate() + days);
  return databaseDateKey(date);
}

export function argentinaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export function occurrenceHasStarted(date: Date, startTime: string) {
  const now = argentinaClock();
  const key = databaseDateKey(date);
  return key < now.date || (key === now.date && startTime <= now.time);
}

export function occurrenceClassName(occurrence: OccurrenceClassSource) {
  const scheduleName = occurrence.schedule?.classType.trim() ?? "";
  const snapshotName = occurrence.classNameSnapshot.trim();
  const categoryName = occurrence.categorySnapshot?.trim() ?? "";
  const today = argentinaClock().date;
  const usesCurrentSchedule =
    occurrence.status === "SCHEDULED" &&
    databaseDateKey(occurrence.date) >= today &&
    Boolean(scheduleName);

  if (usesCurrentSchedule) return scheduleName;
  return snapshotName || scheduleName || categoryName || "Clase";
}

export async function syncFutureOccurrenceNamesForSchedule(
  schedule: { id: string; classType: string },
  client: DbClient = prisma,
) {
  const classType = schedule.classType.trim();
  if (!classType) return 0;
  const result = await client.classOccurrence.updateMany({
    where: {
      scheduleId: schedule.id,
      status: "SCHEDULED",
      date: { gte: dateKeyToDatabase(argentinaDateKey()) },
      OR: [
        { classNameSnapshot: { not: classType } },
        { categorySnapshot: { not: classType } },
      ],
    },
    data: {
      classNameSnapshot: classType,
      categorySnapshot: classType,
    },
  });
  return result.count;
}

export async function ensureClassOccurrences(daysAhead = 28, client: DbClient = prisma) {
  const today = argentinaDateKey();
  const end = addDateKeyDays(today, daysAhead);
  const schedules = await client.weeklyClassSchedule.findMany({
    where: { active: true },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true, capacity: true },
  });
  const rows: Prisma.ClassOccurrenceCreateManyInput[] = [];
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const dateKey = addDateKeyDays(today, offset);
    const day = dateKeyToDatabase(dateKey).getUTCDay();
    for (const schedule of schedules) {
      if (weekdayNumber[schedule.dayOfWeek] !== day) continue;
      rows.push({
        scheduleId: schedule.id,
        date: dateKeyToDatabase(dateKey),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        classNameSnapshot: schedule.classType,
        categorySnapshot: schedule.classType,
        capacityOverride: schedule.capacity,
      });
    }
  }
  if (rows.length) await client.classOccurrence.createMany({ data: rows, skipDuplicates: true });
  for (const schedule of schedules) {
    await syncFutureOccurrenceNamesForSchedule(schedule, client);
  }
  return { from: today, to: end };
}

export function occurrenceStatusLabel(status: string, started: boolean) {
  if (status === "CANCELLED") return "Cancelada";
  if (status === "COMPLETED" || started) return "Finalizada";
  return "Programada";
}
