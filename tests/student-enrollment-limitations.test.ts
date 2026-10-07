import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Prisma } from "@prisma/client";
import * as onboarding from "../lib/student-onboarding.ts";
import * as height from "../lib/height.ts";
import { resolvePortalStudentIdentity } from "../lib/portal-student-identity.ts";
import type { Student } from "../types/gestion.ts";

const require = createRequire(import.meta.url);
function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name: string) => name in dependencies ? dependencies[name] : require(name), exports);
  return exports as T;
}

type Row = { id: string; workspaceId: string; serviceType: string; data: Record<string, unknown>; primaryScheduleId: null; weeklyClasses: [] };
const base = { birthDate: "2000-01-01", height: null, weight: null, goal: "Ganar fuerza", experienceLevel: "Principiante", trainingExperience: "Menos de 6 meses", hasLimitations: false, limitations: "", notes: "Observación del entrenador" };
const { serializeStudent } = load<{ serializeStudent: (row: Row) => Student }>("lib/student-enrollment.ts", {
  "server-only": {}, "@/lib/student-media": { studentProfilePhoto: () => "" }, "@/lib/trainer-workspace": {},
  "@/lib/height": height, "@/lib/prisma": {}, "@/lib/payment-dates": {}, "@/types/gestion": { isStudentType: () => true },
  "@/lib/student-service": {}, "@/lib/coach-plans": {}, "@/lib/student-phone-identity": {},
});
const { StudentHealthObservations } = load<{ StudentHealthObservations: (props: { student: Student }) => React.ReactNode }>("componentes/student-health-observations.tsx", {});
const html = (student: Student) => renderToStaticMarkup(React.createElement(StudentHealthObservations, { student }));

function setup(serviceType: string) {
  const a: Row = { id: "student-a", workspaceId: "workspace-a", serviceType, data: { ...base }, primaryScheduleId: null, weeklyClasses: [] };
  const b: Row = { ...a, id: "student-b", workspaceId: "workspace-b", data: { ...base, hasLimitations: true, limitations: "Dato privado B" } };
  const rows = [a, b];
  const studentRecord = {
    findUnique: async ({ where }: { where: { id: string; workspaceId?: string } }) => rows.find((row) => row.id === where.id && (!where.workspaceId || row.workspaceId === where.workspaceId)) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: { data: Record<string, unknown> } }) => {
      const row = rows.find((row) => row.id === where.id)!;
      row.data = data.data;
      return row;
    },
  };
  const { PATCH } = load<{ PATCH: (request: Request) => Promise<Response> }>("app/api/portal/onboarding/route.ts", {
    "@/lib/prisma": { prisma: { studentRecord } },
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: a.id, credential: { mustChangePassword: false, student: a } }) },
    "@/lib/student-onboarding": onboarding,
    "@/lib/self-service": { isSelfService: () => false },
  });
  const { GET } = load<{ GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> }>("app/api/alumnos/[id]/route.ts", {
    "@/lib/prisma": { prisma: { studentRecord } }, "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: a.workspaceId }) },
    "@/lib/coached-students": { coachedStudentsWhere: {} }, "@/lib/student-enrollment": { serializeStudent, studentInclude: {} },
    "@/lib/student-points": {}, "@/lib/student-history": {}, "@/lib/payment-dates": {}, "@prisma/client": { Prisma },
  });
  const save = (data: Record<string, unknown>) => PATCH(new Request("https://example.test/api/portal/onboarding", { method: "PATCH", body: JSON.stringify({ step: 4, complete: true, studentId: b.id, workspaceId: b.workspaceId, data }) }));
  const get = (id: string) => GET(new Request("https://example.test/api/alumnos/" + id), { params: Promise.resolve({ id }) });
  return { a, b, save, get };
}

for (const service of ["CLASSES", "PERSONALIZED", "MIXED"]) {
  test(`${service}: alta sin molestia, persistencia y ficha sin falso positivo`, async () => {
    const { a, save, get } = setup(service);
    assert.equal((await save({ ...base, limitations: "Texto anterior que debe limpiarse" })).status, 200);
    assert.equal(a.data.onboardingCompleted, true);
    assert.equal(a.data.limitations, "");
    const student = await (await get(a.id)).json() as Student;
    assert.equal(student.hasLimitations, false);
    assert.doesNotMatch(html(student), /indicó que tiene|Texto anterior/);
  });
  test(`${service}: payload real de onboarding llega a la ficha, sin cruzar alumno ni workspace`, async () => {
    const { a, b, save, get } = setup(service);
    const text = "Rodilla derecha al hacer sentadillas";
    const response = await save({ ...base, hasLimitations: true, limitations: ` ${text} `, studentId: b.id, workspaceId: b.workspaceId });
    assert.equal(response.status, 200);
    assert.equal(a.data.hasLimitations, true);
    assert.equal(a.data.limitations, text);
    assert.equal(b.data.limitations, "Dato privado B");
    const student = await (await get(a.id)).json() as Student;
    assert.equal(student.serviceType, service);
    assert.match(html(student), /molestia o limitación: Sí/);
    assert.ok(html(student).includes(text));
    assert.equal((await get(b.id)).status, 404);
  });
}

test("campos legados null/vacíos y texto largo o HTML se muestran de forma segura", () => {
  const row: Row = { id: "legacy", workspaceId: "a", serviceType: "CLASSES", data: { ...base, hasLimitations: null, limitations: null }, primaryScheduleId: null, weeklyClasses: [] };
  assert.doesNotMatch(html(serializeStudent(row)), /indicó que tiene/);
  row.data.hasLimitations = true;
  assert.match(html(serializeStudent(row)), /Sin descripción informada/);
  row.data.limitations = "<script>" + "Rodilla".repeat(65);
  const markup = html(serializeStudent(row));
  assert.ok(markup.includes("&lt;script&gt;"));
  assert.match(markup, /whitespace-pre-wrap break-words \[overflow-wrap:anywhere\]/);
});

test("el formulario envía ambos campos y la ficha usa el componente para todos los servicios", () => {
  const form = readFileSync("componentes/student-onboarding.tsx", "utf8");
  assert.match(form, /data: form/);
  assert.match(form, /hasLimitations: true/);
  assert.match(form, /limitations: event.target.value/);
  assert.match(readFileSync("app/alumnos/page.tsx", "utf8"), /<StudentHealthObservations student=\{item\}\/>/);
  assert.equal(resolvePortalStudentIdentity({ studentId: "a", credential: { student: { id: "b", workspaceId: "b" } } }), null);
});
