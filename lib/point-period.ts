import { argentinaDateKey, argentinaDateTimeBoundary, argentinaMonthBounds } from "./payment-dates.ts";

export type PointRankingPeriod = "month" | "30d" | "total";

export function pointPeriodStart(period: PointRankingPeriod, reference = new Date()) {
  if (period === "total") return null;
  const todayKey = argentinaDateKey(reference);
  if (period === "30d") return new Date(argentinaDateTimeBoundary(todayKey).getTime() - 29 * 86400000);
  const { monthStart } = argentinaMonthBounds(todayKey);
  return argentinaDateTimeBoundary(monthStart);
}
