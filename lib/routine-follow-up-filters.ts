export type RoutineTrainingLocation = "gym" | "studio" | "home";

function normalized(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function routineTrainingLocation(value: string): RoutineTrainingLocation | null {
  const location = normalized(value);
  if (["gimnasio", "gimnasio completo", "full gym"].includes(location)) return "gym";
  if (["salon", "salon bm", "salon bm training"].includes(location)) return "studio";
  if (["casa", "home"].includes(location)) return "home";
  return null;
}

function storedCalendarDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value.length <= 10 ? `${value}T12:00:00Z` : value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function argentinaCalendarDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(value);
  const number = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(number("year"), number("month") - 1, number("day"));
}

export function isActivePainReport(reportDate: string | Date, today = new Date()) {
  const ageInDays = Math.floor((argentinaCalendarDay(today) - storedCalendarDay(reportDate)) / 86_400_000);
  return ageInDays >= 0 && ageInDays <= 7;
}
