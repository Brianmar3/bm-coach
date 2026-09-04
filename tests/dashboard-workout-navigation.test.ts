import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { completedWorkoutPriorityHref, completedWorkoutPrioritySubtitle, type DashboardCompletedWorkout } from "../lib/dashboard-workout-priority.ts";

const workout = (sessionId: string, studentId: string, studentName = "Delfi Damnoti"): DashboardCompletedWorkout => ({
  sessionId,
  studentId,
  studentName,
  routineId: "routine-1",
  routineName: "Rutina delfi <3",
  date: "2026-09-04",
  completedAt: "2026-09-04T14:00:00.000Z",
});

test("un solo entrenamiento navega al seguimiento de esa sesión", () => {
  const href = completedWorkoutPriorityHref([workout("session-1", "student-1")]);
  const url = new URL(href, "https://bm.test");
  assert.equal(url.pathname, "/rutinas");
  assert.equal(url.searchParams.get("tab"), "seguimiento");
  assert.equal(url.searchParams.get("studentId"), "student-1");
  assert.equal(url.searchParams.get("sessionId"), "session-1");
});

test("la prioridad no vuelve al listado general de Rutinas", () => {
  assert.notEqual(completedWorkoutPriorityHref([workout("session-1", "student-1")]), "/rutinas?tab=seguimiento");
});

test("el payload conserva el studentId real", () => {
  const url = new URL(completedWorkoutPriorityHref([workout("session-1", "student-real")]), "https://bm.test");
  assert.equal(url.searchParams.get("studentId"), "student-real");
});

test("el payload conserva el sessionId real", () => {
  const url = new URL(completedWorkoutPriorityHref([workout("session-real", "student-1")]), "https://bm.test");
  assert.equal(url.searchParams.get("sessionId"), "session-real");
});

test("varios entrenamientos abren un listado filtrado sin elegir uno arbitrariamente", () => {
  const url = new URL(completedWorkoutPriorityHref([workout("session-1", "student-1"), workout("session-2", "student-2")]), "https://bm.test");
  assert.equal(url.searchParams.get("studentId"), null);
  assert.equal(url.searchParams.get("sessionId"), null);
  assert.equal(url.searchParams.get("studentIds"), "student-1,student-2");
  assert.equal(url.searchParams.get("sessionIds"), "session-1,session-2");
  assert.equal(completedWorkoutPrioritySubtitle([workout("session-1", "student-1"), workout("session-2", "student-2")]), "Revisar sesiones recientes");
});

test("varias sesiones del mismo alumno abren su pestaña Sesiones sin elegir una", () => {
  const url = new URL(completedWorkoutPriorityHref([workout("session-1", "student-1"), workout("session-2", "student-1")]), "https://bm.test");
  assert.equal(url.searchParams.get("studentId"), "student-1");
  assert.equal(url.searchParams.get("sessionId"), null);
  assert.equal(url.searchParams.get("sessionIds"), "session-1,session-2");
});

test("una sesión inexistente mantiene como fallback la pestaña Sesiones del alumno", () => {
  const source = readFileSync(new URL("../componentes/routine-follow-up-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /setTab\(preferredTab\)/);
  assert.match(source, /body\.sessions\.find\(\(session\) => session\.id === preferredSessionId\) \?\? null/);
  assert.match(source, /initialSessionId \|\| initialSessionIds\.length \? "sesiones" : "resumen"/);
});

test("las demás prioridades del Dashboard conservan sus destinos", () => {
  const source = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(source, /id: "quotas"[\s\S]*?href: "\/pagos"/);
  assert.match(source, /id: "activity"[\s\S]*?href: "\/asistencias\?view=low-activity"/);
  assert.match(source, /id: "payments"[\s\S]*?href: "\/resumen-mensual"/);
});

test("el Dashboard expone el contexto real y una línea compacta para una sesión", () => {
  const api = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(api, /sessionId: session\.id/);
  assert.match(api, /studentId: session\.studentId/);
  assert.match(api, /routineName: session\.routineNameSnapshot/);
  assert.match(api, /completedAt: session\.updatedAt\.toISOString\(\)/);
  assert.equal(completedWorkoutPrioritySubtitle([workout("session-1", "student-1")]), "Delfi Damnoti · Rutina delfi <3");
});
