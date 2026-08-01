import { ARGENTINA_TIME_ZONE, addMonthsToDateKey, argentinaDateKey, argentinaDateTimeBoundary, isDateKey } from "./payment-dates.ts";

export type MonthSelection = { year: number; month: number };

export function validMonthSelection(year: number, month: number): year is number {
  return Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

export function monthKey({ year, month }: MonthSelection) {
  if (!validMonthSelection(year, month)) throw new Error("Mes inválido.");
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthSelectionFromKey(value: string): MonthSelection | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return validMonthSelection(year, month) ? { year, month } : null;
}

export function monthDateKeys(selection: MonthSelection) {
  const start = `${monthKey(selection)}-01`;
  return { start, endExclusive: addMonthsToDateKey(start), period: start };
}

export function monthDatabaseBounds(selection: MonthSelection) {
  const keys = monthDateKeys(selection);
  return {
    ...keys,
    startDate: new Date(`${keys.start}T12:00:00.000Z`),
    endDate: new Date(`${keys.endExclusive}T12:00:00.000Z`),
    startInstant: argentinaDateTimeBoundary(keys.start),
    endInstant: argentinaDateTimeBoundary(keys.endExclusive),
  };
}

export function shiftMonth(selection: MonthSelection, delta: number): MonthSelection {
  const shifted = addMonthsToDateKey(`${monthKey(selection)}-01`, delta);
  return { year: Number(shifted.slice(0, 4)), month: Number(shifted.slice(5, 7)) };
}

export function currentArgentinaMonth(now = new Date()): MonthSelection {
  const today = argentinaDateKey(now);
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function monthLabel(selection: MonthSelection) {
  const key = `${monthKey(selection)}-15`;
  if (!isDateKey(key)) throw new Error("Mes inválido.");
  const formatted = new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00.000Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function dueDateForPeriod(period: string, configuredDueDate: string) {
  const day = isDateKey(configuredDueDate) ? Number(configuredDueDate.slice(8, 10)) : 10;
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
