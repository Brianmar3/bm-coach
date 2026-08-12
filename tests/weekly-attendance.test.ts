import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addDateDays,
  argentinaDateKey,
  assignmentCoversDateKeys,
  attendancePercentage,
  filterWeeklyStudents,
  isWeeklyAttendanceDisplayDate,
  mondayForArgentinaDate,
  studentIsActiveOnDate,
  summarizeStudent,
  weekDays,
  weekLabel,
  weekRange,
  weeklyAttendanceCsv,
  weeklyAttendanceDisplayDays,
  type WeeklyAttendanceEntry,
  type WeeklyAttendanceResponse,
} from "../lib/weekly-attendance.ts";
import { weeklyCompliance } from "../lib/weekly-compliance.ts";
import { hasGroupClasses } from "../lib/student-service.ts";

function entry(status: WeeklyAttendanceEntry["status"], date = "2026-07-27", id: string = status): WeeklyAttendanceEntry {
  return { id, occurrenceId: `occ-${id}`, scheduleId: "functional-18", date, startTime: "18:00", endTime: "19:00", discipline: "Funcional", status, recordedAt: null, observation: null, recordedBy: null, method: null };
}

const student = summarizeStudent({
  id: "student-a",
  name: "Ana Pérez",
  studentType: "Adulto",
  service: "Clases",
  plan: "3 días",
  entries: [entry("PRESENT"), entry("ABSENT", "2026-07-29", "absence"), entry("PRESENT", "2026-07-31", "present-2")],
});

test("la fecha argentina respeta el día local antes de medianoche UTC", () => {
  assert.equal(argentinaDateKey(new Date("2026-08-03T02:30:00.000Z")), "2026-08-02");
  assert.equal(mondayForArgentinaDate("2026-08-02"), "2026-07-27");
});

test("la semana va de lunes a domingo con fin exclusivo", () => {
  assert.deepEqual(weekRange("2026-08-01"), { start: "2026-07-27", end: "2026-08-02", endExclusive: "2026-08-03" });
  assert.equal(weekDays("2026-07-27").length, 7);
  assert.equal(weekDays("2026-07-27")[6].shortLabel, "Dom 2");
  assert.equal(weekLabel("2026-07-27"), "Semana del 27 de julio al 2 de agosto de 2026");
});

test("la presentación semanal muestra lunes a viernes y oculta sábado y domingo", () => {
  const displayed = weeklyAttendanceDisplayDays(weekDays("2026-07-27"));
  assert.equal(displayed.length, 5);
  assert.deepEqual(displayed.map((day) => day.shortLabel.slice(0, 3)), ["Lun", "Mar", "Mié", "Jue", "Vie"]);
  assert.equal(displayed.some((day) => day.shortLabel.startsWith("Sáb") || day.shortLabel.startsWith("Dom")), false);
  assert.equal(isWeeklyAttendanceDisplayDate("2026-08-01"), false);
  assert.equal(isWeeklyAttendanceDisplayDate("2026-08-02"), false);
  assert.equal(isWeeklyAttendanceDisplayDate("2026-08-03"), true);
});

test("semana anterior y siguiente conservan lunes", () => {
  assert.equal(addDateDays("2026-07-27", -7), "2026-07-20");
  assert.equal(addDateDays("2026-07-27", 7), "2026-08-03");
});

test("presentes y ausentes forman el porcentaje esperado", () => {
  assert.equal(student.present, 2);
  assert.equal(student.absent, 1);
  assert.equal(student.percentage, 66.7);
});

test("justificadas no se confunden con presentes y forman parte del porcentaje", () => {
  const result = summarizeStudent({ ...student, entries: [entry("PRESENT"), entry("JUSTIFIED", "2026-07-29")] });
  assert.equal(result.justified, 1);
  assert.equal(result.percentage, 50);
});

test("canceladas y sin registro no crean faltas", () => {
  const result = summarizeStudent({ ...student, entries: [entry("CANCELLED"), entry("NO_RECORD", "2026-07-29")] });
  assert.equal(result.absent, 0);
  assert.equal(result.percentage, null);
});

test("la división por cero devuelve No disponible mediante null", () => {
  assert.equal(attendancePercentage(0, 0), null);
});

test("un alta a mitad de semana excluye fechas anteriores", () => {
  assert.equal(studentIsActiveOnDate("2026-07-30", [], "2026-07-29"), false);
  assert.equal(studentIsActiveOnDate("2026-07-30", [], "2026-07-30"), true);
});

test("baja, suspensión y reactivación respetan eventos históricos", () => {
  const events = [
    { type: "DEACTIVATION", date: "2026-07-29" },
    { type: "REACTIVATION", date: "2026-08-03" },
  ];
  assert.equal(studentIsActiveOnDate("2026-01-01", events, "2026-07-28"), true);
  assert.equal(studentIsActiveOnDate("2026-01-01", events, "2026-07-31"), false);
  assert.equal(studentIsActiveOnDate("2026-01-01", events, "2026-08-03"), true);
});

test("la asignación solo cubre su intervalo fechado", () => {
  assert.equal(assignmentCoversDateKeys("2026-07-27", "2026-07-29", "2026-07-28"), true);
  assert.equal(assignmentCoversDateKeys("2026-07-27", "2026-07-29", "2026-07-30"), false);
});

test("dos clases del mismo día se conservan en historial pero cumplen una sola vez", () => {
  const result = summarizeStudent({ ...student, entries: [entry("PRESENT", "2026-07-27", "functional"), { ...entry("PRESENT", "2026-07-27", "gap"), discipline: "GAP", scheduleId: "gap-19" }] });
  assert.equal(result.entries.length, 2);
  assert.equal(result.present, 1);
});

test("el cierre semanal usa frecuencia y presentes reales sin depender del horario", () => {
  const records = [
    { date: "2026-08-03", status: "PRESENT" },
    { date: "2026-08-05", status: "PRESENT" },
  ];
  assert.deepEqual(weeklyCompliance(3, records, true), {
    expected: 3, presentDays: 2, manualAbsent: 0, justified: 0,
    automaticAbsent: 1, resolved: 2, closed: true,
  });
  assert.equal(weeklyCompliance(3, [...records, { date: "2026-08-07", status: "PRESENT" }], true).automaticAbsent, 0);
  assert.equal(weeklyCompliance(5, [...records, { date: "2026-08-06", status: "PRESENT" }, { date: "2026-08-07", status: "PRESENT" }], true).automaticAbsent, 1);
  assert.equal(weeklyCompliance(2, [
    { date: "2026-08-03", status: "PRESENT" },
    { date: "2026-08-03", status: "PRESENT" },
  ], true).automaticAbsent, 1);
});

test("ausente y justificado manuales resuelven cupos sin ser sobrescritos", () => {
  const result = weeklyCompliance(3, [
    { date: "2026-08-03", status: "PRESENT" },
    { date: "2026-08-05", status: "ABSENT" },
    { date: "2026-08-07", status: "JUSTIFIED" },
  ], true);
  assert.equal(result.manualAbsent, 1);
  assert.equal(result.justified, 1);
  assert.equal(result.automaticAbsent, 0);
});

test("la semana actual no cierra y el cálculo repetido es idempotente", () => {
  const records = [{ date: "2026-08-10", status: "PRESENT" }];
  assert.equal(weeklyCompliance(3, records, false).automaticAbsent, 0);
  assert.deepEqual(weeklyCompliance(3, records, true), weeklyCompliance(3, records, true));
});

test("Personalizado puro queda fuera; Clases y Mixto participan", () => {
  assert.equal(hasGroupClasses("PERSONALIZED"), false);
  assert.equal(hasGroupClasses("CLASSES"), true);
  assert.equal(hasGroupClasses("MIXED"), true);
});

test("los filtros combinan disciplina, estado, servicio, faltas y asistencia baja", () => {
  const kids = summarizeStudent({ id: "student-b", name: "Ben Kids", studentType: "Kids", service: "Clases", plan: null, entries: [{ ...entry("PRESENT"), discipline: "Kids", scheduleId: "kids" }] });
  assert.deepEqual(filterWeeklyStudents([student, kids], { discipline: "Funcional", status: "ABSENT", service: "Clases", onlyAbsent: true, onlyLowAttendance: true }).map((item) => item.id), ["student-a"]);
  assert.deepEqual(filterWeeklyStudents([student, kids], { discipline: "Kids" }).map((item) => item.id), ["student-b"]);
});

test("el CSV es UTF-8, usa columnas en español y conserva filtros", () => {
  const data: WeeklyAttendanceResponse = {
    metadata: { start: "2026-07-27", end: "2026-08-02", endExclusive: "2026-08-03", label: weekLabel("2026-07-27"), generatedAt: "2026-08-01T12:00:00.000Z", historicalIncomplete: false },
    summary: { studentsWithAttendance: 1, present: 2, absent: 1, justified: 0, attendancePercentage: 66.7, completedClasses: 3, cancelledClasses: 0, averagePerStudent: 2 },
    days: weekDays("2026-07-27"), students: [student], disciplines: ["Funcional"], schedules: [{ id: "functional-18", label: "Funcional · 18:00" }], warnings: [],
  };
  const csv = weeklyAttendanceCsv(data, [student]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Porcentaje semanal"/);
  assert.match(csv, /"Ana Pérez"/);
  assert.match(csv, /"Ausente"/);
});

test("la API semanal exige sesión y rechaza identificadores arbitrarios", () => {
  const source = readFileSync(new URL("../app/api/asistencias/semana/route.ts", import.meta.url), "utf8");
  assert.match(source, /verifyAdminSessionValue/);
  assert.match(source, /studentId/);
  assert.match(source, /trainerId/);
  assert.match(source, /organizationId/);
  assert.doesNotMatch(source, /searchParams\.get\("studentId"\)/);
});

test("la carga semanal usa un lote fijo de consultas y no consulta dentro de un bucle por alumno", () => {
  const source = readFileSync(new URL("../lib/weekly-attendance-data.ts", import.meta.url), "utf8");
  assert.match(source, /Promise\.all/);
  const querySection = source.slice(source.indexOf("const [attendanceRecords"), source.indexOf("const studentById"));
  assert.equal((querySection.match(/findMany/g) ?? []).length, 5);
  assert.doesNotMatch(source, /for \(const student[^)]*\)[\s\S]{0,300}prisma\./);
});

test("la vista semanal prioriza la revisión rápida en escritorio y móvil", () => {
  const source = readFileSync(new URL("../componentes/weekly-attendance-history.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Datos históricos y limitaciones/);
  assert.doesNotMatch(source, />Disciplina<select|>Horario<select|>Estado<select|>Servicio<select/);
  assert.match(source, /type="week"/);
  assert.match(source, /Alumnos con asistencia/);
  assert.match(source, /Frecuencia \/ plan/);
  assert.match(source, /filter\(\(day\) => day\.entries\.length > 0\)/);
  assert.match(source, /Sin registro/);
  assert.match(source, /Sin clase/);
  assert.match(source, /weeklyAttendanceDisplayDays\(data\.days\)/);
  assert.match(source, />Totales</);
  assert.match(source, /min-w-\[860px\]/);
  assert.match(source, /sticky left-0/);
  assert.match(source, /relevantDays.*filter\(\(day\) => day\.entries\.length > 0\)/s);
});

test("el detalle semanal es compacto y omite metadatos vacíos", () => {
  const source = readFileSync(new URL("../componentes/weekly-attendance-history.tsx", import.meta.url), "utf8");
  const detail = source.slice(source.indexOf("function AttendanceDetail("), source.indexOf("function Empty("));
  assert.match(detail, /Detalle semanal/);
  assert.match(detail, /aria-label="Cerrar detalle semanal"/);
  assert.match(detail, /Ir a la ficha general/);
  assert.match(detail, /entry\.observation &&/);
  assert.match(detail, /entry\.recordedBy &&/);
  assert.match(detail, /entry\.method &&/);
  assert.match(detail, /entry\.recordedAt &&/);
  assert.doesNotMatch(detail, /No disponible/);
  assert.match(detail, /space-y-2/);
  assert.match(detail, /overflow-y-auto/);
  assert.match(detail, /isWeeklyAttendanceDisplayDate\(entry\.date\)/);
});
