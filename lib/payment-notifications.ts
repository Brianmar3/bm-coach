import "server-only";

import { Prisma, type StudentPayment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey } from "@/lib/payment-dates";
import { currentArgentinaMonth, monthDatabaseBounds } from "@/lib/monthly-period";
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

export async function persistPaymentConfirmation(
  transaction: Prisma.TransactionClient,
  payment: Pick<StudentPayment, "id" | "studentId" | "paidDate" | "dueDate">,
) {
  const onTime = Boolean(payment.paidDate && paymentWasOnTime(payment.paidDate, payment.dueDate));
  const message = onTime
    ? `Tu pago fue cargado correctamente. Sumaste +${ON_TIME_PAYMENT_POINTS} puntos por pagar en término.`
    : "Tu pago fue cargado correctamente.";
  await transaction.studentNotification.upsert({
    where: { eventKey: paymentConfirmationEventKey(payment.id) },
    create: {
      studentId: payment.studentId,
      type: "PAYMENT",
      eventKey: paymentConfirmationEventKey(payment.id),
      title: "Pago registrado ✅",
      message,
      url: PAYMENT_PORTAL_URL,
    },
    update: {},
  });
  if (onTime && payment.paidDate) {
    await transaction.studentPointTransaction.upsert({
      where: {
        studentId_eventKey: {
          studentId: payment.studentId,
          eventKey: onTimePaymentPointEventKey(payment.id),
        },
      },
      create: {
        studentId: payment.studentId,
        eventKey: onTimePaymentPointEventKey(payment.id),
        eventType: "PAYMENT",
        sourceType: "PAYMENT",
        sourceId: payment.id,
        points: ON_TIME_PAYMENT_POINTS,
        description: "Pago de cuota registrado en término",
        occurredAt: payment.paidDate,
        notifiedAt: new Date(),
      },
      update: { active: true, invalidatedAt: null },
    });
  }
  return { onTime, message };
}

export async function sendPaymentConfirmationPush(
  payment: Pick<StudentPayment, "id" | "studentId" | "paidDate" | "dueDate">,
) {
  const onTime = Boolean(payment.paidDate && paymentWasOnTime(payment.paidDate, payment.dueDate));
  const body = onTime
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
  const bounds = monthDatabaseBounds(currentArgentinaMonth(new Date(`${today}T12:00:00.000Z`)));
  const obligations = await prisma.monthlyStudentObligation.findMany({
    where: {
      period: bounds.startDate,
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      balance: { gt: 0 },
    },
    include: { student: { select: { data: true } } },
    orderBy: [{ dueDate: "asc" }, { studentId: "asc" }],
  });
  if (!obligations.length) return [];
  const paid = await prisma.studentPayment.groupBy({
    by: ["studentId"],
    where: {
      billingPeriod: bounds.startDate,
      status: "PAGADO",
      studentId: { in: obligations.map((item) => item.studentId) },
    },
    _sum: { amount: true },
  });
  const paidByStudent = new Map(paid.map((item) => [item.studentId, Number(item._sum.amount ?? 0)]));
  const created: CreatedPaymentReminder[] = [];
  for (const obligation of obligations) {
    if (storedStudent(obligation.student.data).status === "inactivo") continue;
    const balance = Math.max(
      Number(obligation.expectedAmount) - (paidByStudent.get(obligation.studentId) ?? 0),
      0,
    );
    if (balance <= 0) continue;
    const kind = paymentReminderKind(obligation.dueDate, today);
    if (!kind) continue;
    const eventKey = paymentReminderEventKey(obligation.id, kind);
    const content = reminderContent(kind, obligation.dueDate, balance);
    try {
      await prisma.studentNotification.create({
        data: {
          studentId: obligation.studentId,
          type: "PAYMENT",
          eventKey,
          title: content.title,
          message: content.message,
          url: PAYMENT_PORTAL_URL,
        },
      });
      created.push({ studentId: obligation.studentId, eventKey, ...content });
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
    url: PAYMENT_PORTAL_URL,
    tag: reminder.eventKey,
  });
}
