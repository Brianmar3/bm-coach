import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classTemplateToClassDraft, classTemplateToRoutineDraft, isReusableCompleteClass } from "../lib/class-template-base.ts";
import type { TrainingExercise, TrainingRoutine, TrainingRoutineBlock, TrainingRoutineDay } from "../types/gestion.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../componentes/routine-management-panel.tsx", import.meta.url), "utf8");

function ids() {
  let value = 0;
  return () => `copy-${++value}`;
}

function exercise(id: string, name: string, order: number, videoUrl = ""): TrainingExercise {
  return { id, blockId: `block-of-${id}`, name, muscleGroup: "Cuerpo completo", sets: 3, repetitions: "10-12", weight: 24, effortType: "RIR", effortValue: 2, restSeconds: 75, observations: "Técnica controlada", videoUrl, tempo: "3-1-1", alternativeExercise: "Variante", equipment: "Mancuerna", optional: false, targetType: "REPS", targetSeconds: null, targetRepetitions: "12", targetDistance: "", targetSide: "Bilateral", order };
}

function block(id: string, type: TrainingRoutineBlock["type"], order: number, exerciseItem: TrainingExercise): TrainingRoutineBlock {
  return { id, type, name: `${type} ${order}`, order, rounds: type === "ROUNDS" ? 4 : null, durationSeconds: type === "EMOM" ? 720 : null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: type === "ROUNDS" ? 90 : null, targetRounds: type === "EMOM" ? 4 : null, instructions: `Indicaciones ${type}`, exercises: [exerciseItem] };
}

function sourceRoutine(days = 1): TrainingRoutine {
  const firstDay: TrainingRoutineDay = {
    id: "day-source",
    dayNumber: 1,
    name: "Funcional Fuerza + EMOM",
    objective: "Fuerza y resistencia",
    warmup: "Movilidad y activación",
    observations: "Vuelta a la calma",
    estimatedMinutes: 60,
    blocks: [
      block("block-strength", "STRENGTH", 1, exercise("exercise-strength", "Sentadilla goblet", 1, "bm-library://exercise/goblet-squat")),
      block("block-emom", "EMOM", 2, exercise("exercise-emom", "Burpee", 1, "https://media.example/burpee.mp4")),
      block("block-rounds", "ROUNDS", 3, exercise("exercise-rounds", "Remo", 1)),
    ],
    exercises: [],
  };
  return {
    id: "routine-source",
    name: "Funcional Fuerza + EMOM",
    objective: "Fuerza y resistencia",
    level: "intermedio",
    status: "activa",
    kind: "template",
    description: "Clase compleja",
    location: "Sala principal",
    equipment: ["Mancuerna", "Cajón"],
    tags: ["Tipo de clase: Funcional", "potencia", "grupo tarde"],
    startDate: "2026-08-15",
    durationWeeks: 8,
    priorityMuscles: ["Piernas"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    archivedAt: "",
    studentIds: ["student-source"],
    students: [{ id: "student-source", name: "Alumno" }],
    historicalStudents: [{ id: "student-old", name: "Histórico" }],
    days: days === 1 ? [firstDay] : [firstDay, { ...firstDay, id: "day-source-2", dayNumber: 2, name: "Día 2" }],
    managementSummary: { completedSessions: 9, latestSessionDate: "2026-08-14", averageDurationMinutes: 58, recentWeeklySessions: [1, 2, 3, 3], latestPainReport: null, progressPercentage: 75 },
  };
}

test("Clase a Clase produce un borrador profundo, independiente y sin IDs persistidos", () => {
  const source = sourceRoutine();
  const original = structuredClone(source);
  const copy = classTemplateToClassDraft(source, ids());
  assert.equal(copy.name, "Copia de Funcional Fuerza + EMOM");
  assert.equal(copy.kind, "template");
  assert.equal(copy.status, "borrador");
  assert.deepEqual(copy.tags, source.tags);
  assert.equal(copy.days[0].clientId, "copy-1");
  assert.deepEqual(copy.days[0].blocks.map((item) => item.clientId), ["copy-2", "copy-4", "copy-6"]);
  assert.deepEqual(copy.days[0].blocks.map((item) => item.exercises[0].clientId), ["copy-3", "copy-5", "copy-7"]);
  assert.equal("id" in copy.days[0], false);
  assert.ok(copy.days[0].blocks.every((item) => item.id === undefined && item.exercises.every((entry) => entry.id === undefined && (entry as { blockId?: string }).blockId === undefined)));
  copy.days[0].blocks[0].name = "Editado sólo en B";
  copy.days[0].blocks[0].exercises[0].weight = 30;
  assert.deepEqual(source, original);
  source.days[0].warmup = "Cambio posterior en A";
  assert.equal(copy.days[0].warmup, "Movilidad y activación");
});

test("Clase a Rutina precarga Día 1, filtra el tipo técnico y excluye operación e historial", () => {
  const source = sourceRoutine();
  const copy = classTemplateToRoutineDraft(source, ids());
  assert.equal(copy.kind, "assigned");
  assert.equal(copy.status, "borrador");
  assert.equal(copy.startDate, "");
  assert.equal(copy.durationWeeks, null);
  assert.deepEqual(copy.studentIds, []);
  assert.deepEqual(copy.priorityMuscles, []);
  assert.deepEqual(copy.tags, ["potencia", "grupo tarde"]);
  assert.equal(copy.days[0].name, "Día 1");
  assert.equal(copy.days[0].warmup, "Movilidad y activación");
  assert.equal(copy.days[0].observations, "Vuelta a la calma");
  assert.equal(copy.days[0].estimatedMinutes, 60);
  copy.days[0].blocks[1].instructions = "Cambio sólo en R";
  assert.equal(source.days[0].blocks[1].instructions, "Indicaciones EMOM");
  source.days[0].blocks[2].name = "Cambio posterior en A";
  assert.equal(copy.days[0].blocks[2].name, "ROUNDS 3");
  for (const excluded of ["id", "createdAt", "updatedAt", "archivedAt", "students", "historicalStudents", "managementSummary"]) assert.equal(excluded in copy, false);
});

test("round trip estructural conserva orden, configuración, multimedia, tags, equipo, entrada y cierre", () => {
  const copy = classTemplateToClassDraft(sourceRoutine(), ids());
  assert.deepEqual(copy.days[0].blocks.map((item) => item.type), ["STRENGTH", "EMOM", "ROUNDS"]);
  assert.deepEqual(copy.days[0].blocks.map((item) => item.order), [1, 2, 3]);
  assert.equal(copy.days[0].blocks[1].durationSeconds, 720);
  assert.equal(copy.days[0].blocks[2].rounds, 4);
  assert.equal(copy.days[0].blocks[2].restBetweenRoundsSeconds, 90);
  assert.equal(copy.days[0].blocks[0].exercises[0].videoUrl, "bm-library://exercise/goblet-squat");
  assert.equal(copy.days[0].blocks[1].exercises[0].videoUrl, "https://media.example/burpee.mp4");
  assert.deepEqual(copy.equipment, ["Mancuerna", "Cajón"]);
  assert.deepEqual(copy.tags, ["Tipo de clase: Funcional", "potencia", "grupo tarde"]);
  assert.equal(copy.days[0].warmup, "Movilidad y activación");
  assert.equal(copy.days[0].observations, "Vuelta a la calma");
});

test("templates legacy multidía conservan Usar plantilla y no abren el flujo de clase moderna", () => {
  assert.equal(isReusableCompleteClass(sourceRoutine(2)), false);
  assert.throws(() => classTemplateToClassDraft(sourceRoutine(2), ids()), /Sólo las clases completas/);
  assert.match(panel, /routine\.days\.length === 1/);
  assert.match(panel, /reusableCompleteClass \? "Usar como base" : "Usar plantilla"/);
  assert.match(panel, /actions\.useTemplate\(routine\)/);
});

test("la decisión es compacta, cancelable y sólo abre el draft local", () => {
  const dialog = page.slice(page.indexOf("function ClassBaseChoiceDialog"), page.indexOf("function RoutineCopyDialog"));
  for (const label of ["Usar como base", "Nueva clase", "Nueva rutina", "Cancelar"]) assert.match(dialog, new RegExp(label));
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /items-end/);
  assert.match(dialog, /sm:max-w-md/);
  assert.doesNotMatch(dialog, /fetch\(|\/api\//);
  const baseFlow = page.slice(page.indexOf("function beginFromClassBase"), page.indexOf("async function submit"));
  assert.doesNotMatch(baseFlow, /fetch\(|\/api\//);
  assert.match(page, /if \(baseDraftDestination === "routine"\) setActiveTab\("rutinas"\)/);
});
