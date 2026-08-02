export const PORTAL_CLASS_SEARCH_DAYS = 35;
export const PORTAL_UPCOMING_DAYS = 7;
export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type PortalClassCandidate = {
  id: string;
  scheduleId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
};

export type PortalAgendaCandidate = PortalClassCandidate & {
  category: string;
};

export type ArgentinaClock = { date: string; time: string };

export type RelevantClassDay = {
  date: string | null;
  title: string;
  subtitle: string;
  occurrenceIds: string[];
  refreshAfterMs: number | null;
};

export type PortalWeeklyScheduleCandidate = {
  scheduleId: string;
  active: boolean;
  endedAt: Date | null;
  schedule: {
    active: boolean;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    classType: string;
  };
};

export type UpcomingClassWindow = {
  from: string;
  to: string;
  occurrenceIds: string[];
};

export type PortalClassAgenda<T extends PortalAgendaCandidate> = {
  occurrences: T[];
  focus: RelevantClassDay;
  upcoming: UpcomingClassWindow;
};

export type StudentClassAvailability = {
  eligible: boolean;
  reason: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  message: string | null;
};

const weekdayOrder: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

export function argentinaLocalClock(date = new Date()): ArgentinaClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}:${part("second")}` };
}

export function addPortalDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seconds(value: string) {
  const [hour, minute, second = 0] = value.split(":").map(Number);
  return hour * 3600 + minute * 60 + second;
}

export function classHasEnded(item: Pick<PortalClassCandidate, "date" | "endTime" | "status">, clock: ArgentinaClock) {
  if (item.status === "CANCELLED" || item.status === "COMPLETED") return true;
  if (item.date < clock.date) return true;
  if (item.date > clock.date) return false;
  return item.endTime.slice(0, 5) <= clock.time.slice(0, 5);
}

export function classIsInProgress(item: Pick<PortalClassCandidate, "date" | "startTime" | "endTime" | "status">, clock: ArgentinaClock) {
  return item.status === "SCHEDULED"
    && item.date === clock.date
    && item.startTime.slice(0, 5) <= clock.time.slice(0, 5)
    && item.endTime.slice(0, 5) > clock.time.slice(0, 5);
}

export function classIsEligibleForStudent(classType: string, studentType: string) {
  const isKidsClass = classType.toLocaleLowerCase("es").includes("kids");
  return studentType === "Kids" ? isKidsClass : !isKidsClass;
}

export function selectActivePortalSchedules<T extends PortalWeeklyScheduleCandidate>(assignments: T[]) {
  return assignments
    .filter((item) => item.active && item.endedAt === null && item.schedule.active)
    .sort((left, right) =>
      (weekdayOrder[left.schedule.dayOfWeek] ?? 99) - (weekdayOrder[right.schedule.dayOfWeek] ?? 99)
      || left.schedule.startTime.localeCompare(right.schedule.startTime),
    );
}

export function studentClassAvailability(status: string | undefined, lifecycleStatus?: string): StudentClassAvailability {
  if (lifecycleStatus === "suspendido") {
    return {
      eligible: false,
      reason: "SUSPENDED",
      message: "Tu cuenta está suspendida. Tus horarios asignados siguen visibles, pero no hay próximas clases disponibles.",
    };
  }
  if (status !== "activo" || lifecycleStatus === "inactivo") {
    return {
      eligible: false,
      reason: "INACTIVE",
      message: "Tu cuenta está inactiva. Tus horarios asignados siguen visibles, pero no hay próximas clases disponibles.",
    };
  }
  return { eligible: true, reason: "ACTIVE", message: null };
}

export function studentIsActiveForClasses(status: string | undefined, lifecycleStatus?: string) {
  return studentClassAvailability(status, lifecycleStatus).eligible;
}

export function selectUpcomingClassWindow(
  occurrences: PortalClassCandidate[],
  now = new Date(),
  daysAhead = PORTAL_UPCOMING_DAYS,
): UpcomingClassWindow {
  const clock = argentinaLocalClock(now);
  const to = addPortalDateDays(clock.date, daysAhead);
  const occurrenceIds = occurrences
    .filter((item) => item.status === "SCHEDULED" && item.date >= clock.date && item.date <= to && !classHasEnded(item, clock))
    .sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime))
    .map((item) => item.id);
  return { from: clock.date, to, occurrenceIds };
}

export function selectPortalClassAgenda<T extends PortalAgendaCandidate>(
  occurrences: T[],
  studentType: string,
  now = new Date(),
): PortalClassAgenda<T> {
  const eligible = occurrences.filter((item) => classIsEligibleForStudent(item.category, studentType));
  return {
    occurrences: eligible,
    focus: selectRelevantClassDay(eligible, now),
    upcoming: selectUpcomingClassWindow(eligible, now),
  };
}

function dateTitle(date: string, today: string) {
  if (date === today) return "Clases de hoy";
  if (date === addPortalDateDays(today, 1)) return "Clases de mañana";
  const parts = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatToParts(new Date(`${date}T12:00:00.000Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const label = `${weekday.charAt(0).toLocaleUpperCase("es")}${weekday.slice(1)} ${part("day")} de ${part("month")}`;
  return `Próximas clases · ${label}`;
}

export function selectRelevantClassDay(
  occurrences: PortalClassCandidate[],
  now = new Date(),
  searchDays = PORTAL_CLASS_SEARCH_DAYS,
): RelevantClassDay {
  const clock = argentinaLocalClock(now);
  const lastDate = addPortalDateDays(clock.date, searchDays);
  const valid = occurrences
    .filter((item) => item.status === "SCHEDULED" && item.date >= clock.date && item.date <= lastDate)
    .sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime));
  const today = valid.filter((item) => item.date === clock.date && !classHasEnded(item, clock));
  const selectedDate = today.length ? clock.date : valid.find((item) => item.date > clock.date)?.date ?? null;
  if (!selectedDate) {
    return {
      date: null,
      title: "Próximas clases",
      subtitle: "No encontramos próximas clases asignadas. Consultá con tu entrenador.",
      occurrenceIds: [],
      refreshAfterMs: null,
    };
  }
  const selected = (selectedDate === clock.date ? today : valid.filter((item) => item.date === selectedDate));
  const lastEnd = selectedDate === clock.date ? Math.max(...selected.map((item) => seconds(item.endTime))) : null;
  const nowSeconds = seconds(clock.time);
  return {
    date: selectedDate,
    title: dateTitle(selectedDate, clock.date),
    subtitle: selectedDate === clock.date ? "Tus clases pendientes o en curso" : "Tu próximo día de entrenamiento",
    occurrenceIds: selected.map((item) => item.id),
    refreshAfterMs: lastEnd === null ? null : Math.max(1_000, (lastEnd - nowSeconds) * 1_000 + 1_000),
  };
}
