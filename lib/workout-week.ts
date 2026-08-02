import {
  ARGENTINA_TIME_ZONE,
  argentinaDateKey,
  argentinaDateTimeBoundary,
  dateKeyToDatabase,
  isDateKey,
} from "./payment-dates.ts";

export { ARGENTINA_TIME_ZONE };

type WeekInput = Date | string;

function inputDateKey(value: WeekInput = new Date()) {
  if (typeof value !== "string") return argentinaDateKey(value);
  if (isDateKey(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida para calcular la semana.");
  return argentinaDateKey(parsed);
}

function addDays(value: string, days: number) {
  if (!isDateKey(value)) throw new Error("Fecha inválida para calcular la semana.");
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekKey(value: WeekInput = new Date()) {
  const dateKey = inputDateKey(value);
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return addDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

export function getLocalWeekStart(value: WeekInput = new Date()) {
  return argentinaDateTimeBoundary(getWeekKey(value));
}

export function getLocalWeekEnd(value: WeekInput = new Date()) {
  const nextWeekStart = argentinaDateTimeBoundary(addDays(getWeekKey(value), 7));
  return new Date(nextWeekStart.getTime() - 1);
}

export function getWorkoutWeekRange(value: WeekInput = new Date()) {
  const weekKey = getWeekKey(value);
  const endExclusiveKey = addDays(weekKey, 7);
  return {
    weekKey,
    startKey: weekKey,
    endKey: addDays(weekKey, 6),
    endExclusiveKey,
    startDate: dateKeyToDatabase(weekKey),
    endExclusiveDate: dateKeyToDatabase(endExclusiveKey),
  };
}

export function workoutDraftStorageKey(studentId: string, routineId: string, dayId: string, weekKey: string) {
  return `bm-workout:${studentId}:${routineId}:${dayId}:${weekKey}`;
}

export function legacyWorkoutDraftStorageKey(studentId: string, dayId: string) {
  return `bm-workout-${studentId}-${dayId}`;
}

type WorkoutWeekSession = {
  routineId: string;
  dayId: string;
  date: string;
  status: "pendiente" | "en_progreso" | "finalizado";
};

export function sessionBelongsToWeek(session: Pick<WorkoutWeekSession, "date">, weekKey: string) {
  return isDateKey(session.date) && getWeekKey(session.date) === weekKey;
}

export function findCurrentWeekSession<T extends WorkoutWeekSession>(
  sessions: T[],
  input: { routineId: string; dayId: string; weekKey: string },
) {
  const matches = sessions.filter((session) =>
    session.routineId === input.routineId
    && session.dayId === input.dayId
    && sessionBelongsToWeek(session, input.weekKey));
  return matches.find((session) => session.status === "en_progreso")
    ?? matches.find((session) => session.status === "finalizado")
    ?? matches[0]
    ?? null;
}

type HistoricalSet = { weight: number | null };

export function createFreshWorkoutSets(count: number, programmedWeight: number | null, previousSets: HistoricalSet[] = []) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    setNumber: index + 1,
    weight: previousSets[index]?.weight ?? programmedWeight,
    repetitions: null,
    effort: null,
    completed: false,
    observation: "",
  }));
}

export function weeklySessionLockKey(studentId: string, routineId: string, dayId: string, weekKey: string) {
  return ["workout-week", studentId, routineId, dayId, weekKey].join(":");
}
