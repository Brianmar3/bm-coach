import { weeklyCompliance } from "./weekly-compliance.ts";

export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type WeeklyAttendanceState =
  | "PRESENT"
  | "ABSENT"
  | "JUSTIFIED"
  | "CANCELLED"
  | "NO_RECORD";

export type WeeklyAttendanceEntry = {
  id: string;
  occurrenceId: string | null;
  scheduleId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  discipline: string;
  status: WeeklyAttendanceState;
  recordedAt: string | null;
  observation: string | null;
  recordedBy: string | null;
  method: string | null;
};

export type WeeklyAttendanceStudent = {
  id: string;
  name: string;
  studentType: string;
  service: string | null;
  plan: string | null;
  entries: WeeklyAttendanceEntry[];
  present: number;
  absent: number;
  justified: number;
  percentage: number | null;
  expected: number;
  completedDays: number;
  automaticAbsent: number;
  weekClosed: boolean;
};

export type WeeklyAttendanceResponse = {
  metadata: {
    start: string;
    end: string;
    endExclusive: string;
    label: string;
    generatedAt: string;
    historicalIncomplete: boolean;
  };
  summary: {
    studentsWithAttendance: number;
    present: number;
    absent: number;
    justified: number;
    attendancePercentage: number | null;
    completedClasses: number | null;
    cancelledClasses: number;
    averagePerStudent: number | null;
  };
  days: Array<{ date: string; shortLabel: string; label: string }>;
  students: WeeklyAttendanceStudent[];
  disciplines: string[];
  schedules: Array<{ id: string; label: string }>;
  warnings: string[];
};

export type WeeklyAttendanceFilters = {
  query?: string;
  discipline?: string;
  scheduleId?: string;
  status?: WeeklyAttendanceState | "";
  service?: string;
  onlyAbsent?: boolean;
  onlyLowAttendance?: boolean;
};

export type WeeklyStudentStatusEvent = {
  type: "ENROLLMENT" | "DEACTIVATION" | "SUSPENSION" | "REACTIVATION" | string;
  date: string;
};

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const SHORT_DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function argentinaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayForArgentinaDate(value: string) {
  if (!isDateKey(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  const weekday = date.getUTCDay();
  return addDateDays(value, -(weekday === 0 ? 6 : weekday - 1));
}

export function weekRange(value: string) {
  const start = mondayForArgentinaDate(value);
  if (!start) return null;
  return { start, end: addDateDays(start, 6), endExclusive: addDateDays(start, 7) };
}

function dateParts(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  return { day: date.getUTCDate(), month: date.getUTCMonth(), year: date.getUTCFullYear(), weekday: date.getUTCDay() };
}

export function weekLabel(start: string) {
  const end = addDateDays(start, 6);
  const first = dateParts(start);
  const last = dateParts(end);
  const firstLabel = first.month === last.month
    ? `${first.day}`
    : `${first.day} de ${MONTH_NAMES[first.month]}`;
  const yearLabel = first.year === last.year ? `${last.year}` : `${first.year} al ${last.year}`;
  return `Semana del ${firstLabel} al ${last.day} de ${MONTH_NAMES[last.month]} de ${yearLabel}`;
}

export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDateDays(start, offset);
    const parts = dateParts(date);
    return {
      date,
      shortLabel: `${SHORT_DAY_NAMES[parts.weekday]} ${parts.day}`,
      label: `${DAY_NAMES[parts.weekday]} ${parts.day} de ${MONTH_NAMES[parts.month]}`,
    };
  });
}

export function isWeeklyAttendanceDisplayDate(value: string) {
  if (!isDateKey(value)) return false;
  const weekday = new Date(`${value}T12:00:00.000Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function weeklyAttendanceDisplayDays<T extends { date: string }>(days: T[]) {
  return days.filter((day) => isWeeklyAttendanceDisplayDate(day.date));
}

export function attendancePercentage(present: number, absent: number, justified = 0) {
  const denominator = present + absent + justified;
  return denominator ? Math.round((present / denominator) * 1000) / 10 : null;
}

export function studentIsActiveOnDate(joinedAt: string | null, events: WeeklyStudentStatusEvent[], date: string) {
  if (joinedAt && joinedAt > date) return false;
  let active = !joinedAt || joinedAt <= date;
  for (const event of [...events].sort((left, right) => left.date.localeCompare(right.date))) {
    if (event.date > date) break;
    if (event.type === "ENROLLMENT" || event.type === "REACTIVATION") active = true;
    if (event.type === "DEACTIVATION" || event.type === "SUSPENSION") active = false;
  }
  return active;
}

export function assignmentCoversDateKeys(assignedAt: string, endedAt: string | null, date: string) {
  return assignedAt <= date && (!endedAt || endedAt >= date);
}

export function summarizeStudent(student: Omit<WeeklyAttendanceStudent, "present" | "absent" | "justified" | "percentage" | "expected" | "completedDays" | "automaticAbsent" | "weekClosed"> & { expected?: number; weekClosed?: boolean }): WeeklyAttendanceStudent {
  const compliance = weeklyCompliance(student.expected, student.entries, student.weekClosed ?? false);
  const absent = compliance.manualAbsent + compliance.automaticAbsent;
  return {
    ...student,
    present: compliance.presentDays,
    absent,
    justified: compliance.justified,
    percentage: attendancePercentage(compliance.presentDays, absent, compliance.justified),
    expected: compliance.expected,
    completedDays: compliance.presentDays,
    automaticAbsent: compliance.automaticAbsent,
    weekClosed: compliance.closed,
  };
}

export function filterWeeklyStudents(students: WeeklyAttendanceStudent[], filters: WeeklyAttendanceFilters) {
  const query = filters.query?.trim().toLocaleLowerCase("es") ?? "";
  return students.filter((student) => {
    if (query && !student.name.toLocaleLowerCase("es").includes(query)) return false;
    if (filters.service && student.service !== filters.service) return false;
    if (filters.discipline && !student.entries.some((entry) => entry.discipline === filters.discipline)) return false;
    if (filters.scheduleId && !student.entries.some((entry) => entry.scheduleId === filters.scheduleId)) return false;
    if (filters.status && !student.entries.some((entry) => entry.status === filters.status)) return false;
    if (filters.onlyAbsent && student.absent === 0) return false;
    if (filters.onlyLowAttendance && (student.percentage === null || student.percentage >= 70)) return false;
    return true;
  });
}

function csvCell(value: string | number | null) {
  const text = value === null ? "No disponible" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

const CSV_STATUS: Record<WeeklyAttendanceState, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  JUSTIFIED: "Justificada",
  CANCELLED: "Cancelada",
  NO_RECORD: "Sin registro",
};

export function weeklyAttendanceCsv(data: WeeklyAttendanceResponse, students = data.students) {
  const header = ["Semana", "Alumno", "Disciplina", "Fecha", "Horario", "Estado", "Observación", "Servicio", "Porcentaje semanal"];
  const rows = students.flatMap((student) => [
    ...student.entries.map((entry) => [
      data.metadata.label,
      student.name,
      entry.discipline,
      entry.date,
      entry.startTime && entry.endTime ? `${entry.startTime}-${entry.endTime}` : entry.startTime,
      CSV_STATUS[entry.status],
      entry.observation ?? "No disponible",
      student.service ?? "No disponible",
      student.percentage === null ? "No disponible" : student.percentage,
    ]),
    ...Array.from({ length: student.automaticAbsent }, () => [
      data.metadata.label,
      student.name,
      "Cierre semanal",
      data.metadata.end,
      "",
      "Ausente",
      "Automático por cierre semanal",
      student.service ?? "No disponible",
      student.percentage === null ? "No disponible" : student.percentage,
    ]),
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
