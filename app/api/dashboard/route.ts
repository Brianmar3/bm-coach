import { Prisma, type ClassWeekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addMonthsToDateKey,
  argentinaDateKey,
  databaseDateKey,
  dateKeyToDatabase,
  paymentAccountStatus,
} from "@/lib/payment-dates";
import type { DashboardData } from "@/types/dashboard";
import type { PaymentAccountStatus, Student } from "@/types/gestion";
import { ensureClassOccurrences } from "@/lib/class-occurrences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKDAY: Partial<Record<number, ClassWeekday>> = { 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY" };
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const STATUS_ORDER: Record<PaymentAccountStatus, number> = { VENCIDA: 0, VENCE_PRONTO: 1, AL_DIA: 2, SIN_CONFIGURAR: 3 };

function studentData(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentName(student: Student) {
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

function addDays(value: string, days: number) {
  const date = dateKeyToDatabase(value);
  date.setUTCDate(date.getUTCDate() + days);
  return databaseDateKey(date);
}

function startOfWeek(value: string) {
  const date = dateKeyToDatabase(value);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return databaseDateKey(date);
}

function planDays(value: string) {
  const match = value.match(/(?:^|\D)([1-7])(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const today = argentinaDateKey();
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonthStart = addMonthsToDateKey(monthStart);
    const previousMonthStart = addMonthsToDateKey(monthStart, -1);
    const weekStart = startOfWeek(today);
    const nextWeekStart = addDays(weekStart, 7);
    const todayDate = dateKeyToDatabase(today);
    const tomorrowDate = dateKeyToDatabase(addDays(today, 1));
    const weekday = WEEKDAY[todayDate.getUTCDay()];
    await ensureClassOccurrences(35);

    const [studentRecords, paymentRecords, todayOccurrences, todayAttendances, weeklyAttendances, newWeeklyAttendances, events] = await Promise.all([
      prisma.studentRecord.findMany({ select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.studentPayment.findMany({
        where: { status: "PAGADO", paidDate: { gte: dateKeyToDatabase(previousMonthStart), lt: dateKeyToDatabase(nextMonthStart) } },
        select: { amount: true, paidDate: true },
        orderBy: { paidDate: "asc" },
      }),
      weekday ? prisma.classOccurrence.findMany({
        where: { date: todayDate },
        include: {
          schedule: { include: { assignments: { include: { student: { select: { data: true } } } } } },
          responses: { include: { student: { select: { data: true } } } },
        },
        orderBy: { startTime: "asc" },
      }) : Promise.resolve([]),
      prisma.classAttendance.groupBy({
        by: ["scheduleId"],
        where: { date: { gte: todayDate, lt: tomorrowDate }, status: "PRESENT" },
        _count: { _all: true },
      }),
      prisma.classAttendance.groupBy({
        by: ["date", "status"],
        where: { date: { gte: dateKeyToDatabase(weekStart), lt: dateKeyToDatabase(nextWeekStart) } },
        _count: { _all: true },
        orderBy: { date: "asc" },
      }),
      prisma.classOccurrenceAttendance.findMany({
        where: {
          actualAttendance: { not: "UNKNOWN" },
          occurrence: { date: { gte: dateKeyToDatabase(weekStart), lt: dateKeyToDatabase(nextWeekStart) } },
        },
        select: { actualAttendance: true, occurrence: { select: { date: true } } },
      }),
      prisma.coachEvent.findMany({
        where: { status: "PENDIENTE", date: { gte: todayDate } },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        take: 3,
      }),
    ]);

    const students = studentRecords.map((record) => ({ ...record, student: studentData(record.data) }));
    const active = students.filter(({ student }) => student.status !== "inactivo");
    const accounts = active.map(({ id, student }) => ({
      studentId: id,
      studentName: studentName(student),
      plan: student.plan ?? "",
      dueDate: student.dueDate ?? "",
      amount: Number(student.monthlyFee ?? 0),
      status: paymentAccountStatus(student.dueDate ?? "", today),
    }));
    const actionableAccounts = accounts
      .filter((account) => account.status === "VENCIDA" || account.status === "VENCE_PRONTO")
      .sort((left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || left.dueDate.localeCompare(right.dueDate));

    const currentPayments = paymentRecords.filter((payment) => payment.paidDate && databaseDateKey(payment.paidDate) >= monthStart);
    const previousPayments = paymentRecords.filter((payment) => payment.paidDate && databaseDateKey(payment.paidDate) < monthStart);
    const monthIncome = currentPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const previousIncome = previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const incomeByDate = new Map<string, number>();
    for (const payment of currentPayments) {
      if (!payment.paidDate) continue;
      const key = databaseDateKey(payment.paidDate);
      incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + Number(payment.amount));
    }
    const elapsedDays = Number(today.slice(8, 10));
    const income = Array.from({ length: elapsedDays }, (_, index) => {
      const date = addDays(monthStart, index);
      return { date, label: String(index + 1), amount: incomeByDate.get(date) ?? 0 };
    });

    const attendanceTodayBySchedule = new Map(todayAttendances.map((item) => [item.scheduleId ?? "", item._count._all]));
    const todayClasses = todayOccurrences.map((occurrence) => ({
      id: occurrence.id,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      name: occurrence.classNameSnapshot,
      enrolled: occurrence.schedule?.assignments.filter(({ student }) => studentData(student.data).status !== "inactivo").length ?? 0,
      attendance: occurrence.responses.some((item) => item.actualAttendance !== "UNKNOWN")
        ? occurrence.responses.filter((item) => item.actualAttendance === "PRESENT").length
        : occurrence.scheduleId ? attendanceTodayBySchedule.get(occurrence.scheduleId) ?? 0 : 0,
      confirmed: occurrence.responses.filter((item) => item.response === "GOING").length,
      confirmedStudents: occurrence.responses.filter((item) => item.response === "GOING").map(({ student }) => studentName(studentData(student.data))),
    }));

    const weeklyAttendance = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const newRecords = newWeeklyAttendances.filter((item) => databaseDateKey(item.occurrence.date) === date);
      const legacyRecords = weeklyAttendances.filter((item) => databaseDateKey(item.date) === date);
      const present = newRecords.length
        ? newRecords.filter((item) => item.actualAttendance === "PRESENT").length
        : legacyRecords.find((item) => item.status === "PRESENT")?._count._all ?? 0;
      const total = newRecords.length ? newRecords.length : legacyRecords.reduce((sum, item) => sum + item._count._all, 0);
      return { date, label: DAY_LABELS[new Date(`${date}T12:00:00.000Z`).getUTCDay()], present, total, percentage: total ? Math.round((present / total) * 100) : 0 };
    });
    const weeklyPresent = weeklyAttendance.reduce((sum, day) => sum + day.present, 0);
    const weeklyTotal = weeklyAttendance.reduce((sum, day) => sum + day.total, 0);
    const bestDay = weeklyAttendance.reduce((best, day) => day.present > best.present ? day : best, weeklyAttendance[0]);

    const currentNewStudents = students.filter(({ createdAt }) => databaseDateKey(createdAt) >= monthStart).length;
    const previousNewStudents = students.filter(({ createdAt }) => {
      const key = databaseDateKey(createdAt);
      return key >= previousMonthStart && key < monthStart;
    }).length;
    const data: DashboardData = {
      generatedAt: new Date().toISOString(),
      today,
      metrics: {
        activeStudents: active.length,
        activeStudentsMonthChange: currentNewStudents - previousNewStudents,
        monthIncome,
        incomeChangePercent: previousIncome > 0 ? Math.round(((monthIncome - previousIncome) / previousIncome) * 100) : null,
        pendingCount: actionableAccounts.length,
        pendingAmount: actionableAccounts.reduce((sum, account) => sum + account.amount, 0),
        overdueCount: actionableAccounts.filter((account) => account.status === "VENCIDA").length,
        classesToday: todayClasses.length,
        attendanceToday: todayAttendances.reduce((sum, item) => sum + item._count._all, 0),
        newStudents: currentNewStudents,
      },
      income,
      todayClasses,
      upcomingPayments: actionableAccounts.slice(0, 3),
      recentStudents: active.slice(0, 6).map(({ id, student }) => ({
        id,
        studentName: studentName(student),
        plan: student.plan ?? "",
        days: planDays(student.plan ?? ""),
        dueDate: student.dueDate ?? "",
        status: paymentAccountStatus(student.dueDate ?? "", today),
      })),
      weeklyAttendance,
      attendanceSummary: {
        weeklyAverage: weeklyTotal ? Math.round((weeklyPresent / weeklyTotal) * 100) : 0,
        bestDay: bestDay?.present ? bestDay.label : "Sin datos",
        totalAttendance: weeklyPresent,
      },
      upcomingEvents: events.map((event) => ({
        id: event.id,
        title: event.title,
        type: event.type.toLowerCase(),
        date: databaseDateKey(event.date),
        time: event.time,
        color: event.color,
        status: event.status.toLowerCase(),
      })),
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al construir el dashboard", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar el Dashboard desde PostgreSQL." }, { status: unavailable ? 503 : 500 });
  }
}
