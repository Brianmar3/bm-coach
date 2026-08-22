import { databaseDateKey, isDateKey } from "./payment-dates.ts";

export const ON_TIME_PAYMENT_POINTS = 5;
export type PaymentReminderKind = "THREE_DAYS" | "DUE_TODAY";

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function paymentWasOnTime(paidDate: Date | string, dueDate: Date | string) {
  const paid = paidDate instanceof Date ? databaseDateKey(paidDate) : paidDate.slice(0, 10);
  const due = dueDate instanceof Date ? databaseDateKey(dueDate) : dueDate.slice(0, 10);
  return isDateKey(paid) && isDateKey(due) && dayNumber(paid) <= dayNumber(due);
}

export function paymentReminderKind(dueDate: Date | string, today: string): PaymentReminderKind | null {
  const due = dueDate instanceof Date ? databaseDateKey(dueDate) : dueDate.slice(0, 10);
  if (!isDateKey(due) || !isDateKey(today)) return null;
  const days = dayNumber(due) - dayNumber(today);
  if (days === 3) return "THREE_DAYS";
  if (days === 0) return "DUE_TODAY";
  return null;
}

export function paymentReminderEventKey(obligationId: string, kind: PaymentReminderKind) {
  return `payment-reminder:${obligationId}:${kind.toLocaleLowerCase("en")}`;
}

export function paymentConfirmationEventKey(paymentId: string) {
  return `payment-confirmation:${paymentId}`;
}

export function onTimePaymentPointEventKey(paymentId: string) {
  return `payment-on-time:${paymentId}`;
}
