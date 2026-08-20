import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findPossibleRoutineDuplicates, normalizeDuplicateRoutineName, routineDeletionRisk, type DuplicateRoutineAuditSource } from "../lib/routine-duplicates.ts";

function routine(overrides: Partial<DuplicateRoutineAuditSource> = {}): DuplicateRoutineAuditSource {
  return {
    id: crypto.randomUUID(),
    name: "Plan Personalizado",
    objective: "Hipertrofia",
    status: "BORRADOR",
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-01T10:00:00Z"),
    students: [],
    days: [{ dayNumber: 1, estimatedMinutes: 45, blocks: [{ order: 1, type: "STRENGTH", rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, exercises: [{ order: 1, name: "Sentadilla", sets: 3, repetitions: "8-10", targetType: "REPS", targetSeconds: null, targetRepetitions: "8-10", targetDistance: null, targetSide: null }] }] }],
    sessionCount: 0,
    lastSessionAt: null,
    assignmentCount: 0,
    versionCount: 0,
    exerciseLogCount: 0,
    blockLogCount: 0,
    followUpCount: 0,
    ...overrides,
  };
}

test("normaliza prefijos y sufijos de copia repetidos sin confundir tildes o espacios", () => {
  assert.equal(normalizeDuplicateRoutineName(" Copia de Copia de Plan Personalizádo (copia) (copia 2) "), "plan personalizado");
});

test("agrupa sólo nombres base, objetivos y estructuras que coinciden", () => {
  const base = routine({ id: "base" });
  const copy = routine({ id: "copy", name: "Copia de Plan Personalizado (copia)", createdAt: new Date("2026-08-02T10:00:00Z") });
  const differentStructure = routine({ id: "different", name: "Plan Personalizado (copia)", days: [{ ...base.days[0], estimatedMinutes: 60 }] });
  const differentName = routine({ id: "other", name: "Plan de fuerza" });
  const groups = findPossibleRoutineDuplicates([base, copy, differentStructure, differentName]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].routines.map((item) => item.id), ["base", "copy"]);
  assert.equal(groups[0].routines.find((item) => item.id === "copy")?.safeToDelete, true);
});

test("considera segura sólo una rutina no activa y completamente vacía de relaciones históricas", () => {
  assert.deepEqual(routineDeletionRisk(routine()), []);
  assert.match(routineDeletionRisk(routine({ status: "ACTIVA" })).join(" "), /activa/i);
  assert.match(routineDeletionRisk(routine({ assignmentCount: 1 })).join(" "), /asignación/i);
  assert.match(routineDeletionRisk(routine({ sessionCount: 1 })).join(" "), /sesión/i);
  assert.match(routineDeletionRisk(routine({ versionCount: 1 })).join(" "), /versión/i);
  assert.match(routineDeletionRisk(routine({ exerciseLogCount: 1 })).join(" "), /progreso de ejercicios/i);
  assert.match(routineDeletionRisk(routine({ blockLogCount: 1 })).join(" "), /progreso de bloques/i);
  assert.match(routineDeletionRisk(routine({ followUpCount: 1 })).join(" "), /comentarios/i);
});

test("el endpoint bloquea relaciones concurrentes y revalida antes del borrado", () => {
  const source = readFileSync(new URL("../app/api/rutinas/duplicados/route.ts", import.meta.url), "utf8");
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /loadRoutineDuplicateGroups\(transaction\)/);
  assert.match(source, /safeToDelete/);
  assert.match(source, /status: 409/);
  assert.match(source, /Esta rutina ahora tiene información asociada y ya no puede eliminarse de forma segura/);
  assert.match(source, /deleteMany/);
  assert.match(source, /currentGroup\.routines\.length - routineIds\.length < 1/);
  assert.doesNotMatch(source, /workoutSession\.(delete|deleteMany|update|updateMany)/);
  assert.doesNotMatch(source, /trainingRoutineAssignment\.(delete|deleteMany|update|updateMany)/);
});

test("la UI conserva decisiones explícitas y no ofrece fusión automática", () => {
  const source = readFileSync(new URL("../componentes/routine-duplicates-review.tsx", import.meta.url), "utf8");
  assert.match(source, /Posibles duplicados/);
  assert.match(source, /Conservar esta/);
  assert.match(source, /Seguro para eliminar/);
  assert.match(source, /Requiere revisión/);
  assert.match(source, /Eliminar definitivamente/);
  assert.doesNotMatch(source, /fusionar|merge/i);
});
