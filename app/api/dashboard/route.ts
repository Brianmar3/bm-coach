import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Student } from "@/types/gestion";
import type { DashboardData, DashboardPaymentItem } from "@/types/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function argentinaDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function studentData(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentName(data: Prisma.JsonValue) {
  const student = studentData(data);
  return `${student.firstName} ${student.lastName}`.trim();
}

function paymentItem(payment: { id: string; amount: Prisma.Decimal; dueDate: Date; student: { data: Prisma.JsonValue } }): DashboardPaymentItem {
  return { id: payment.id, studentName: studentName(payment.student.data), amount: Number(payment.amount), dueDate: payment.dueDate.toISOString().slice(0, 10) };
}

function monthKeys(todayKey: string) {
  const [year, month] = todayKey.split("-").map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    return {
      month: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(".", ""),
    };
  });
}

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const todayKey = argentinaDateKey();
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const inSevenDays = addDays(today, 7);
    inSevenDays.setUTCHours(23, 59, 59, 999);
    const monthStart = new Date(`${todayKey.slice(0, 7)}-01T00:00:00.000Z`);
    const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const months = monthKeys(todayKey);
    const chartStart = new Date(`${months[0].month}-01T00:00:00.000Z`);

    const [students, income, overdue, dueSoon, events, latestEvaluations, chartEvaluations, routines] = await Promise.all([
      prisma.studentRecord.findMany({ select: { data: true } }),
      prisma.studentPayment.aggregate({ where: { status: "PAGADO", paidDate: { gte: monthStart, lt: nextMonth } }, _sum: { amount: true } }),
      prisma.studentPayment.findMany({ where: { status: { not: "PAGADO" }, dueDate: { lt: today } }, include: { student: true }, orderBy: { dueDate: "asc" } }),
      prisma.studentPayment.findMany({ where: { status: { not: "PAGADO" }, dueDate: { gte: today, lte: inSevenDays } }, include: { student: true }, orderBy: { dueDate: "asc" } }),
      prisma.coachEvent.findMany({ where: { status: "PENDIENTE", date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 5 }),
      prisma.physicalEvaluation.findMany({ include: { student: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5 }),
      prisma.physicalEvaluation.findMany({ where: { date: { gte: chartStart } }, select: { date: true, weight: true, height: true } }),
      prisma.trainingRoutine.findMany({ include: { assignments: { include: { student: true } }, days: { include: { _count: { select: { exercises: true } } } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    const evaluationGroups = new Map<string, { weights: number[]; bmis: number[] }>();
    for (const evaluation of chartEvaluations) {
      const key = evaluation.date.toISOString().slice(0, 7);
      const group = evaluationGroups.get(key) ?? { weights: [], bmis: [] };
      const weight = evaluation.weight === null ? null : Number(evaluation.weight);
      const height = evaluation.height === null ? null : Number(evaluation.height);
      if (weight !== null) group.weights.push(weight);
      if (weight !== null && height !== null && height > 0) group.bmis.push(weight / (height * height));
      evaluationGroups.set(key, group);
    }

    const studentMonths = new Map<string, number>();
    for (const record of students) {
      const joinedAt = studentData(record.data).joinedAt;
      if (joinedAt) studentMonths.set(joinedAt.slice(0, 7), (studentMonths.get(joinedAt.slice(0, 7)) ?? 0) + 1);
    }

    const average = (values: number[]) => values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    const data: DashboardData = {
      generatedAt: new Date().toISOString(),
      metrics: {
        activeStudents: students.filter((record) => studentData(record.data).status === "activo").length,
        monthIncome: Number(income._sum.amount ?? 0),
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((sum, payment) => sum + Number(payment.amount), 0),
        dueSoonCount: dueSoon.length,
        dueSoonAmount: dueSoon.reduce((sum, payment) => sum + Number(payment.amount), 0),
      },
      overduePayments: overdue.slice(0, 5).map(paymentItem),
      dueSoonPayments: dueSoon.slice(0, 5).map(paymentItem),
      upcomingEvents: events.map((event) => ({ id: event.id, title: event.title, type: event.type.toLowerCase(), date: event.date.toISOString().slice(0, 10), time: event.time, color: event.color })),
      latestEvaluations: latestEvaluations.map((evaluation) => {
        const weight = evaluation.weight === null ? null : Number(evaluation.weight);
        const height = evaluation.height === null ? null : Number(evaluation.height);
        return { id: evaluation.id, studentName: studentName(evaluation.student.data), date: evaluation.date.toISOString().slice(0, 10), weight, bmi: weight !== null && height !== null && height > 0 ? Math.round((weight / (height * height)) * 10) / 10 : null, bodyFatPercentage: evaluation.bodyFatPercentage === null ? null : Number(evaluation.bodyFatPercentage) };
      }),
      latestRoutines: routines.map((routine) => ({ id: routine.id, name: routine.name, objective: routine.objective, level: routine.level.toLowerCase(), status: routine.status.toLowerCase(), createdAt: routine.createdAt.toISOString(), students: routine.assignments.map((assignment) => studentName(assignment.student.data)).sort((a, b) => a.localeCompare(b, "es")), daysCount: routine.days.filter((day) => day._count.exercises > 0).length, exercisesCount: routine.days.reduce((sum, day) => sum + day._count.exercises, 0) })),
      evolution: months.map(({ month, label }) => { const group = evaluationGroups.get(month) ?? { weights: [], bmis: [] }; return { month, label, averageWeight: average(group.weights), averageBmi: average(group.bmis), newStudents: studentMonths.get(month) ?? 0 }; }),
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al construir el dashboard", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar el Dashboard desde PostgreSQL." }, { status: unavailable ? 503 : 500 });
  }
}
