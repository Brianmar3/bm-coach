import type { PaymentAccountStatus } from "@/types/gestion";

export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function argentinaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isDateKey(value: string) {
  if (!DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateKeyToDatabase(value: string) {
  if (!isDateKey(value)) throw new Error("Fecha inválida.");
  return new Date(`${value}T12:00:00.000Z`);
}

export function databaseDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addMonthsToDateKey(value: string, months = 1) {
  if (!isDateKey(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function nextPaymentDueDate(currentDueDate: string, paidDate: string) {
  return addMonthsToDateKey(isDateKey(currentDueDate) ? currentDueDate : paidDate);
}

function utcDayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function paymentAccountStatus(dueDate: string, today = argentinaDateKey()): PaymentAccountStatus {
  if (!isDateKey(dueDate)) return "SIN_CONFIGURAR";
  const days = utcDayNumber(dueDate) - utcDayNumber(today);
  if (days < 0) return "VENCIDA";
  if (days <= 5) return "VENCE_PRONTO";
  return "AL_DIA";
}

export function argentinaMonthBounds(today = argentinaDateKey()) {
  const monthStart = `${today.slice(0, 7)}-01`;
  return { monthStart, nextMonthStart: addMonthsToDateKey(monthStart) };
}
