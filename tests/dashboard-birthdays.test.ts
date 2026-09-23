import assert from "node:assert/strict";
import test from "node:test";
import { dashboardBirthdays } from "../lib/dashboard-read-model.ts";

const workspaceId = "workspace-a";
const candidate = (overrides: Partial<Parameters<typeof dashboardBirthdays>[0][number]> = {}) => ({
  studentId: "student-1",
  studentName: "Juan Pérez",
  birthDate: "2000-09-23",
  status: "activo",
  workspaceId,
  ...overrides,
});

test("cumpleaños hoy aparece sin comparar el año", () => {
  assert.deepEqual(dashboardBirthdays([candidate()], "2026-09-23", workspaceId), [{ studentId: "student-1", studentName: "Juan Pérez" }]);
});

test("cumpleaños mañana o ayer no aparece", () => {
  assert.deepEqual(dashboardBirthdays([candidate()], "2026-09-22", workspaceId), []);
  assert.deepEqual(dashboardBirthdays([candidate()], "2026-09-24", workspaceId), []);
});

test("respeta workspace, estado y exclusión de SELF_SERVICE", () => {
  const result = dashboardBirthdays([
    candidate(),
    candidate({ studentId: "other-workspace", workspaceId: "workspace-b" }),
    candidate({ studentId: "inactive", status: "inactivo" }),
    candidate({ studentId: "self-service", accountType: "SELF_SERVICE" }),
  ], "2026-09-23", workspaceId);
  assert.deepEqual(result.map((item) => item.studentId), ["student-1"]);
});

test("muestra todos los cumpleaños del día", () => {
  const result = dashboardBirthdays([candidate(), candidate({ studentId: "student-2", studentName: "Ana López" })], "2026-09-23", workspaceId);
  assert.deepEqual(result.map((item) => item.studentId), ["student-1", "student-2"]);
});

test("compara claves de fecha locales sin desplazamiento UTC y deja 29/02 sin alerta en años no bisiestos", () => {
  assert.deepEqual(dashboardBirthdays([candidate({ birthDate: "2000-09-22" })], "2026-09-22", workspaceId).map((item) => item.studentId), ["student-1"]);
  assert.deepEqual(dashboardBirthdays([candidate({ birthDate: "2000-02-29" })], "2026-02-28", workspaceId), []);
  assert.deepEqual(dashboardBirthdays([candidate({ birthDate: "2000-02-29" })], "2028-02-29", workspaceId).map((item) => item.studentId), ["student-1"]);
});
