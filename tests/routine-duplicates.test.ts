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
    initialVersion: null,
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
  const initialVersion = { version: 1, summary: "Versión inicial", snapshot: { studentIds: [] } };
  assert.deepEqual(routineDeletionRisk(routine({ versionCount: 1, initialVersion })), []);
  assert.deepEqual(routineDeletionRisk(routine({ versionCount: 1, initialVersion: { ...initialVersion, summary: "Copia independiente creada" } })), []);
  assert.match(routineDeletionRisk(routine({ versionCount: 2, initialVersion })).join(" "), /historial de versiones/i);
  assert.match(routineDeletionRisk(routine({ versionCount: 1, initialVersion: { ...initialVersion, summary: "Estado anterior al primer cambio" } })).join(" "), /versión inicial/i);
  assert.match(routineDeletionRisk(routine({ versionCount: 1, initialVersion: { ...initialVersion, snapshot: { studentIds: ["alumno"] } } })).join(" "), /versión inicial/i);
  assert.match(routineDeletionRisk(routine({ status: "ACTIVA" })).join(" "), /activa/i);
  assert.match(routineDeletionRisk(routine({ assignmentCount: 1, versionCount: 1, initialVersion })).join(" "), /asignación/i);
  assert.match(routineDeletionRisk(routine({ sessionCount: 1, versionCount: 1, initialVersion })).join(" "), /sesión/i);
  assert.match(routineDeletionRisk(routine({ versionCount: 1 })).join(" "), /versión/i);
  assert.match(routineDeletionRisk(routine({ exerciseLogCount: 1, versionCount: 1, initialVersion })).join(" "), /progreso de ejercicios/i);
  assert.match(routineDeletionRisk(routine({ blockLogCount: 1, versionCount: 1, initialVersion })).join(" "), /progreso de bloques/i);
  assert.match(routineDeletionRisk(routine({ followUpCount: 1, versionCount: 1, initialVersion })).join(" "), /comentarios/i);
});

test("una copia con versión inicial sin uso es elegible sin borrar la rutina conservada", () => {
  const base = routine({ id: "base", versionCount: 1, initialVersion: { version: 1, summary: "Versión inicial", snapshot: { studentIds: [] } } });
  const copy = routine({ id: "copy", name: "Copia de Plan Personalizado", versionCount: 1, initialVersion: { version: 1, summary: "Copia independiente creada", snapshot: { studentIds: [] } } });
  const group = findPossibleRoutineDuplicates([base, copy])[0];
  assert.equal(group.routines.length, 2);
  assert.equal(group.routines.find((item) => item.id === "copy")?.safeToDelete, true);
  assert.equal(group.routines.find((item) => item.id === "copy")?.hasHistory, false);
});

test("el endpoint bloquea relaciones concurrentes y revalida antes del borrado", () => {
  const source = readFileSync(new URL("../app/api/rutinas/duplicados/route.ts", import.meta.url), "utf8");
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /loadRoutineDuplicateGroups\(transaction, workspaceId\)/);
  assert.match(source, /safeToDelete/);
  assert.match(source, /status: 409/);
  assert.match(source, /Esta rutina ahora tiene información asociada y ya no puede eliminarse de forma segura/);
  assert.match(source, /deleteMany/);
  assert.match(source, /currentGroup\.routines\.length - routineIds\.length < 1/);
  assert.match(source, /workspaceId, scope: "WORKSPACE"/);
  assert.doesNotMatch(source, /workoutSession\.(delete|deleteMany|update|updateMany)/);
  assert.doesNotMatch(source, /trainingRoutineAssignment\.(delete|deleteMany|update|updateMany)/);
});

test("la auditoría identifica la versión inicial y aísla los grupos por workspace", () => {
  const source = readFileSync(new URL("../lib/routine-duplicate-audit.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../prisma/migrations/20260723231500_routine_versions_and_detached_history/migration.sql", import.meta.url), "utf8");
  assert.match(source, /versions: \{ select: \{ version: true, summary: true, snapshot: true \}/);
  assert.match(source, /where: \{ workspaceId, scope: "WORKSPACE", kind: "ASSIGNED" \}/);
  assert.match(schema, /model TrainingRoutineVersion \{[\s\S]*?routine\s+TrainingRoutine @relation\(fields: \[routineId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(migration, /FOREIGN KEY \("routineId"\) REFERENCES "training_routines"\("id"\)\s+ON DELETE CASCADE/);
});

test("la UI conserva decisiones explícitas y no ofrece fusión automática", () => {
  const source = readFileSync(new URL("../componentes/routine-duplicates-review.tsx", import.meta.url), "utf8");
  assert.match(source, /Posibles duplicados/);
  assert.match(source, /Conservar esta/);
  assert.match(source, /Seguro para eliminar/);
  assert.match(source, /Solo se puede archivar: conserva el historial/);
  assert.match(source, /Eliminar definitivamente/);
  assert.match(source, /Eliminar rutina/);
  assert.match(source, /pendingDelete\.group\.routines\.filter/);
  assert.match(source, /No se puede deshacer/);
  assert.match(source, /routine\.status !== "ARCHIVADA" && <button/);
  assert.doesNotMatch(source, /fusionar|merge/i);
});
