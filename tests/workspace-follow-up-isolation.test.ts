import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  followUpAssignmentWhere,
  followUpRecordBelongsToWorkspace,
  followUpSessionWhere,
} from "../lib/routine-follow-up-scope.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("Workspace A y B no pueden seleccionar seguimientos del otro", () => {
  const records = [
    { id: "a", studentWorkspaceId: "workspace-a", routineWorkspaceId: "workspace-a" },
    { id: "b", studentWorkspaceId: "workspace-b", routineWorkspaceId: "workspace-b" },
    { id: "mixed", studentWorkspaceId: "workspace-a", routineWorkspaceId: "workspace-b" },
  ];
  assert.deepEqual(records.filter((record) => followUpRecordBelongsToWorkspace("workspace-a", record)).map((record) => record.id), ["a"]);
  assert.deepEqual(records.filter((record) => followUpRecordBelongsToWorkspace("workspace-b", record)).map((record) => record.id), ["b"]);
  assert.deepEqual(followUpSessionWhere("workspace-a", { studentId: "student-a" }), {
    studentId: "student-a",
    student: { workspaceId: "workspace-a" },
    routine: { workspaceId: "workspace-a" },
  });
  assert.deepEqual(followUpAssignmentWhere("workspace-b", { active: true }), {
    active: true,
    student: { workspaceId: "workspace-b" },
    routine: { workspaceId: "workspace-b" },
  });
});

test("resumen resuelve workspace desde sesión y acota asignaciones y sesiones", () => {
  const source = read("app/api/seguimiento/resumen/route.ts");
  assert.ok(source.indexOf("requireAdminApiResponse()") < source.indexOf("trainingRoutineAssignment.findMany"));
  assert.ok(source.indexOf("requireTrainerWorkspace()") < source.indexOf("trainingRoutineAssignment.findMany"));
  assert.match(source, /followUpAssignmentWhere\(workspaceId/);
  assert.match(source, /followUpSessionWhere\(workspaceId/);
  assert.doesNotMatch(source, /where: \{ active: true, routine:/);
});

test("detalle repite el workspace en cada query privada y devuelve 404 cruzado", () => {
  const source = read("app/api/seguimiento/detalle/route.ts");
  assert.match(source, /assertStudentInWorkspace\(studentId, workspaceId\)/);
  assert.match(source, /followUpSessionWhere\(workspaceId/);
  assert.match(source, /physicalEvaluation\.findMany\(\{ where: \{ studentId, student: \{ workspaceId \} \}/);
  assert.match(source, /findUnique\(\{ where: \{ id: studentId, workspaceId \}/);
  assert.match(source, /isWorkspaceResourceNotFound\(error\)[^]*status: 404/);
});

test("filtros, mutaciones y borrados no confían en IDs del cliente", () => {
  const followUp = read("app/api/seguimiento/route.ts");
  const routines = read("app/api/rutinas/route.ts");
  assert.match(followUp, /assertStudentInWorkspace\(studentId, workspaceId\)/);
  assert.match(followUp, /assertRoutineInWorkspace\(routineId, workspaceId\)/);
  assert.match(followUp, /followUpSessionWhere\(workspaceId/);
  assert.match(followUp, /occurrence: \{ workspaceId \}/);
  assert.match(routines, /assertStudentInWorkspace\(studentId, workspaceId\)/);
  assert.match(routines, /followUpSessionWhere\(workspaceId/);
});

test("UI y APIs de seguimiento desactivan caches compartidas", () => {
  const ui = read("componentes/routine-follow-up-dashboard.tsx") + read("componentes/routine-follow-up.tsx");
  const api = read("app/api/seguimiento/route.ts") + read("app/api/seguimiento/resumen/route.ts") + read("app/api/seguimiento/detalle/route.ts");
  assert.match(ui, /cache: "no-store"/);
  assert.match(api, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(api, /unstable_cache|use cache|globalThis/);
});
