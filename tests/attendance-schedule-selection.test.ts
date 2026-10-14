import assert from "node:assert/strict";
import test from "node:test";
import { attendanceEntryKey, classesView } from "../lib/classes-navigation.ts";
import { readFileSync } from "node:fs";
import { automaticAttendanceSchedule, attendanceScheduleSelection } from "../lib/attendance-schedule-selection.ts";

const date = "2026-10-06";
const schedules = [
  { id: "first", dayOfWeek: "TUESDAY", startTime: "06:00", endTime: "07:00", active: true, students: [] },
  { id: "second", dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "09:00", active: true, students: [] },
  { id: "last", dayOfWeek: "TUESDAY", startTime: "18:00", endTime: "19:00", active: true, students: [] },
];
function at(clock: string) { return new Date(`${date}T${clock}:00-03:00`); }

test("en curso, próxima, primera y última, incluso sin alumnos", () => {
  for (const [clock, expected] of [["05:00", "first"], ["06:00", "first"], ["06:30", "first"], ["07:10", "second"], ["18:30", "last"], ["22:00", "last"]]) {
    assert.equal(automaticAttendanceSchedule(schedules, date, at(clock)), expected);
  }
});
test("el fin es exclusivo y las clases consecutivas seleccionan la siguiente", () => {
  const consecutive = [...schedules, { ...schedules[1], id: "boundary", startTime: "07:00", endTime: "08:00" }];
  assert.equal(automaticAttendanceSchedule(consecutive, date, at("07:00")), "boundary");
  assert.equal(automaticAttendanceSchedule(consecutive, date, at("08:00")), "second");
});
test("superpuestas: inicio más reciente y desempate estable independiente del orden recibido", () => {
  const overlap = [...schedules, { ...schedules[0], id: "overlap", startTime: "06:15", endTime: "07:15" }];
  assert.equal(automaticAttendanceSchedule(overlap, date, at("06:30")), "overlap");
  assert.equal(automaticAttendanceSchedule([...overlap].reverse(), date, at("06:30")), "overlap");
  assert.equal(schedules[0].id, "first");
});
test("fecha distinta, días vacíos e inactivos no inventan una selección", () => {
  assert.equal(automaticAttendanceSchedule(schedules, "2026-10-07", at("06:30")), "");
  assert.equal(automaticAttendanceSchedule([], date, at("06:30")), "");
  assert.equal(automaticAttendanceSchedule(schedules.map((s) => ({ ...s, active: false })), date, at("06:30")), "");
  assert.equal(automaticAttendanceSchedule([...schedules, { ...schedules[0], id: "wed", dayOfWeek: "WEDNESDAY" }], "2026-10-07", at("06:30")), "wed");
});
test("usa hora argentina y respeta selección manual, incluyendo Sin horario fijo", () => {
  assert.equal(automaticAttendanceSchedule(schedules, date, new Date("2026-10-06T09:30:00Z")), "first");
  assert.equal(attendanceScheduleSelection("last", "first"), "last");
  assert.equal(attendanceScheduleSelection("", "first"), "");
  assert.equal(attendanceScheduleSelection(null, "second"), "second");
});
test("la integración reinicia sólo al cambiar fecha y el drawer separa el pie de la navegación", () => {
  const page = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
  assert.match(page, /function changeDate\(value: string\).*if \(value === date\) return;.*setScheduleId\(null\)/);
  assert.match(page, /function changeSchedule\(value: string\).*setScheduleId\(value\)/);
  const sidebar = readFileSync(new URL("../componentes/sidebar.tsx", import.meta.url), "utf8");
  assert.match(sidebar, /min-h-0 flex-1 overflow-y-auto">\{nav\}<\/div>/);
  assert.match(sidebar, /shrink-0 border-t.*\{logoutButton\}/);
});

test("la URL decide la vista, sin heredar poca actividad de entradas anteriores", () => {
  for (const [url, expected] of [
    ["/asistencias?view=low-activity", "low-activity"],
    ["/asistencias?view=attendance", "attendance"],
    ["/asistencias", "attendance"],
    ["/clases?view=low-activity", "calendar"],
    ["/asistencias?view=history", "history"],
    ["/asistencias?view=unknown", "attendance"],
    ["/asistencias?view=low-activity", "low-activity"],
    ["/asistencias?view=attendance&scheduleId=other", "attendance"],
  ]) {
    const entry = new URL(url, "https://bm.test");
    assert.equal(classesView(entry.pathname, entry.searchParams), expected);
  }
});

test("cada destino inicializa su formulario; refresh y orden de query conservan la identidad", () => {
  const key = (search: string) => attendanceEntryKey(new URLSearchParams(search));
  assert.notEqual(key("view=low-activity"), key("view=attendance"));
  assert.notEqual(key("scheduleId=a&date=2026-10-14"), key("scheduleId=b&date=2026-10-15"));
  assert.notEqual(key("studentId=a"), key("studentId=b"));
  assert.equal(key("scheduleId=a&date=2026-10-14"), key("date=2026-10-14&scheduleId=a"));
  assert.equal(key(""), key("view=attendance"));
  const attendance = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
  assert.match(attendance, /key=\{attendanceEntryKey\(searchParams\)\}/);
});

test("Volver reemplaza la subvista por Clases y las acciones declaran asistencia", () => {
  const attendance = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
  const tabs = readFileSync(new URL("../componentes/classes-secondary-nav.tsx", import.meta.url), "utf8");
  assert.match(attendance, /href="\/clases" replace/);
  assert.match(tabs, /classesView\(pathname, searchParams\)/);
  assert.match(tabs, /href="\/asistencias\?view=attendance"/);
  for (const file of ["app/dashboard/page.tsx", "app/clases/page.tsx", "componentes/class-occurrence-admin.tsx", "componentes/trainer-command-palette.tsx", "lib/trainer-commands.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /\/asistencias\?view=attendance/);
  }
});

