import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toggledAttendanceStatus } from "../lib/attendance-state.ts";

const classes = readFileSync(new URL("../app/clases/page.tsx", import.meta.url), "utf8");
const occurrences = readFileSync(new URL("../componentes/class-occurrence-admin.tsx", import.meta.url), "utf8");
const attendance = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/asistencias/route.ts", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../componentes/classes-secondary-nav.tsx", import.meta.url), "utf8");

test("Ver detalle y Tomar asistencia navegan a la clase seleccionada", () => {
  assert.match(occurrences, /Ver detalle →/);
  assert.match(occurrences, /scheduleId=.*date=/);
  assert.match(classes, /Tomar asistencia/);
  assert.match(classes, /scheduleId=.*attendanceDate/);
  assert.match(attendance, /calendarMode \? entryScheduleId/);
});

test("cada estado alterna con Sin registro y reemplaza a los demás", () => {
  for (const status of ["presente", "ausente", "justificado"] as const) {
    assert.equal(toggledAttendanceStatus(null, status), status);
    assert.equal(toggledAttendanceStatus(status, status), null);
  }
  assert.equal(toggledAttendanceStatus("presente", "ausente"), "ausente");
  assert.equal(toggledAttendanceStatus("ausente", "justificado"), "justificado");
});

test("Sin registro se persiste eliminando asistencia y conservando confirmación", () => {
  assert.match(api, /record\.status === null/);
  assert.match(api, /classAttendance\.deleteMany/);
  assert.match(api, /actualAttendance: "UNKNOWN"/);
  assert.match(api, /checkedInAt: null/);
  assert.doesNotMatch(api, /classOccurrenceAttendance\.delete/);
});

test("la UI revierte ante error y bloquea doble interacción mientras guarda", () => {
  assert.match(attendance, /setRoster\(previousRoster\)/);
  assert.match(attendance, /savingLock\.current/);
  assert.match(attendance, /disabled=\{saving\}/);
});

test("calendario, métricas y tabs usan estructura compacta mobile-first", () => {
  assert.match(classes, /grid grid-cols-3 divide-x/);
  assert.match(classes, /\+ Crear horario →/);
  assert.match(classes, /grid gap-2 sm:grid-cols-2/);
  assert.match(tabs, /overflow-x-auto/);
  assert.match(tabs, /shrink-0/);
  const primaryCard = occurrences.slice(occurrences.indexOf("function OccurrenceCard"), occurrences.indexOf("function StudentGroup"));
  assert.doesNotMatch(primaryCard, /Asistencia real/);
});
