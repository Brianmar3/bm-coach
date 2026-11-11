import "server-only";

import { Prisma, type StudentPayment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey } from "@/lib/payment-dates";
import { resolveStudentPaymentReminders } from "@/lib/payment-reminder-state";
import { databaseDateKey } from "@/lib/payment-dates";
import {
  ON_TIME_PAYMENT_POINTS,
  onTimePaymentPointEventKey,
  paymentConfirmationEventKey,
  paymentReminderEventKey,
  paymentReminderKind,
  paymentWasOnTime,
  type PaymentReminderKind,
} from "@/lib/payment-notification-rules";
import { sendStudentPush } from "@/lib/push-notifications";
import type { Student } from "@/types/gestion";
import { activeSportsPointStart } from "@/lib/sports-point-policy";
import { isCompetitiveGamificationEligible } from "@/lib/student-service";

import { studentFeeDestination } from "@/lib/student-notification-destination";

const PAYMENT_PORTAL_URL = "/portal/pagos";

function storedStudent(value: Prisma.JsonValue) {
  return value as unknown as Partial<Student>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function hasPositivePaymentAmount(amount: StudentPayment["amount"]) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}

export async function reconcilePaymentPoints(
  transaction: Prisma.TransactionClient,
  payment: Pick<StudentPayment, "id" | "studentId" | "paidDate" | "dueDate" | "amount"> & Partial<Pick<StudentPayment, "status">>,
) {
  if (activeSportsPointStart()) {
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"sports-points:" + payment.studentId})::bigint)`);
  }
  const eventKey = onTimePaymentPointEventKey(payment.id);
  const student = await transaction.studentRecord.findUnique({ where: { id: payment.studentId }, select: { serviceType: true } });
  if ((payment.status && payment.status !== "PAGADO") || !payment.paidDate ||
      !paymentWasOnTime(payment.paidDate, payment.dueDate) || !hasPositivePaymentAmount(payment.amount) || !student || !isCompetitiveGamificationEligible(student.serviceType)) {
    await transaction.studentPointTransaction.updateMany({
      where: { studentId: payment.studentId, eventKey, sourceType: "PAYMENT", active: true },
      data: { active: false, invalidatedAt: new Date() },
    });
    return false;
  }

  const occurredAt = new Date(databaseDateKey(payment.paidDate) + "T12:00:00Z");
  await transaction.studentPointTransaction.upsert({
    where: { studentId_eventKey: { studentId: payment.studentId, eventKey } },
    create: {
      studentId: payment.studentId, eventKey, eventType: "PAYMENT", sourceType: "PAYMENT", sourceId: payment.id,
      points: ON_TIME_PAYMENT_POINTS, description: "Pago de cuota registrado en término", occurredAt, notifiedAt: new Date(),
    },
    update: { occurredAt, active: true, invalidatedAt: null },
  });
  return true;
}

export async function persistPaymentConfirmation(
  transaction: Prisma.TransactionClient,
  payment: Pick<StudentPayment, "id" | "studentId" | "paidDate" | "dueDate" | "amount">,
) {
  const onTime = Boolean(payment.paidDate && paymentWasOnTime(payment.paidDate, payment.dueDate));
  const awardsPoints = await reconcilePaymentPoints(transaction, payment);
  const message = awardsPoints
    ? `Tu pago fue cargado correctamente. Sumaste +${ON_TIME_PAYMENT_POINTS} puntos por pagar en término.`
    : "Tu pago fue cargado correctamente.";
  await transaction.studentNotification.upsert({
    where: { eventKey: paymentConfirmationEventKey(payment.id) },
    create: {
      studentId: payment.studentId,
      type: "PAYMENT",
      eventKey: paymentConfirmationEventKey(payment.id),
      title: "Pago registrado",
      message,
      url: PAYMENT_PORTAL_URL,
    },
    update: {},
  });
  await resolveStudentPaymentReminders(transaction, payment.studentId);
  return { onTime, awardsPoints, message };
}

export async function sendPaymentConfirmationPush(
  payment: Pick<StudentPayment, "id" | "studentId" | "paidDate" | "dueDate" | "amount">,
) {
  const [student, onTime] = await Promise.all([
    prisma.studentRecord.findUnique({ where: { id: payment.studentId }, select: { serviceType: true } }),
    Promise.resolve(Boolean(payment.paidDate && paymentWasOnTime(payment.paidDate, payment.dueDate))),
  ]);
  const body = onTime && hasPositivePaymentAmount(payment.amount) && student && isCompetitiveGamificationEligible(student.serviceType)
    ? `Tu pago fue cargado correctamente. Sumaste +${ON_TIME_PAYMENT_POINTS} puntos por pagar en término.`
    : "Tu pago fue cargado correctamente.";
  await sendStudentPush(payment.studentId, {
    title: "Pago registrado ✅",
    body,
    url: PAYMENT_PORTAL_URL,
    tag: `payment-confirmation-${payment.id}`,
  });
}

export type CreatedPaymentReminder = {
  notificationId: string;
  obligationId: string;
  dueDate: string;
  studentId: string;
  eventKey: string;
  title: string;
  message: string;
};

function reminderContent(kind: PaymentReminderKind, dueDate: Date, balance: number) {
  const title = kind === "THREE_DAYS" ? "Tu cuota vence pronto" : "Tu cuota vence hoy";
  return {
    title,
    message: `Vencimiento: ${formatDate(dueDate)}. Importe pendiente: ${formatMoney(balance)}.`,
  };
}

export async function createPaymentReminders(today = argentinaDateKey()) {
  const next = new Date(`${today}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 3);
  const obligations = await prisma.monthlyStudentObligation.findMany({
    where: {
      dueDate: { in: [new Date(`${today}T00:00:00Z`), next] },
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      balance: { gt: 0 },
    },
    include: { student: { select: { data: true } } },
    orderBy: [{ dueDate: "asc" }, { studentId: "asc" }],
  });
  if (!obligations.length) return [];
  const paid = await prisma.studentPayment.groupBy({
    by: ["studentId", "billingPeriod"],
    where: {
      billingPeriod: { in: obligations.map(item => item.period) },
      status: "PAGADO",
      studentId: { in: obligations.map((item) => item.studentId) },
    },
    _sum: { amount: true },
  });
  const paidByStudent = new Map(paid.map((item) => [`${item.studentId}:${item.billingPeriod ? databaseDateKey(item.billingPeriod) : ""}`, Number(item._sum.amount ?? 0)]));
  const created: CreatedPaymentReminder[] = [];
  for (const obligation of obligations) {
    if (storedStudent(obligation.student.data).status === "inactivo") continue;
    const balance = Math.max(
      Number(obligation.expectedAmount) - (paidByStudent.get(`${obligation.studentId}:${databaseDateKey(obligation.period)}`) ?? 0),
      0,
    );
    if (balance <= 0) continue;
    const kind = paymentReminderKind(obligation.dueDate, today);
    if (!kind) continue;
    const eventKey = paymentReminderEventKey(obligation.id, kind, databaseDateKey(obligation.dueDate));
    const legacy = await prisma.studentNotification.findUnique({ where: { eventKey: paymentReminderEventKey(obligation.id, kind) } });
    if (legacy && legacy.title !== "Recordatorio resuelto" && legacy.message.includes(formatDate(obligation.dueDate))) continue;
    const content = reminderContent(kind, obligation.dueDate, balance);
    try {
      const notification = await prisma.studentNotification.create({ data: { studentId: obligation.studentId, type: "PAYMENT", eventKey, ...content, url: PAYMENT_PORTAL_URL } });
      if (notification) created.push({ notificationId: notification.id, obligationId: obligation.id, dueDate: databaseDateKey(obligation.dueDate), studentId: obligation.studentId, eventKey, ...content });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
  }
  return created;
}

export async function sendPaymentReminderPush(reminder: CreatedPaymentReminder) {
  await sendStudentPush(reminder.studentId, {
    title: reminder.title,
    body: reminder.message,
    url: studentFeeDestination(reminder.notificationId),
    tag: reminder.eventKey,
  }, async () => {
    const obligation = await prisma.monthlyStudentObligation.findFirst({ where: { id: reminder.obligationId, studentId: reminder.studentId }, include: { student: { select: { data: true } } } });
    if (!obligation || obligation.status === "VOID" || databaseDateKey(obligation.dueDate) !== reminder.dueDate || storedStudent(obligation.student.data).status === "inactivo" || !paymentReminderKind(obligation.dueDate, argentinaDateKey())) return false;
    const paid = await prisma.studentPayment.aggregate({ where: { studentId: reminder.studentId, billingPeriod: obligation.period, status: "PAGADO" }, _sum: { amount: true } });
    return Number(obligation.expectedAmount) > Number(paid._sum.amount ?? 0);
  });
}
