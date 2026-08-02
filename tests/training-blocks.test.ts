import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyBlockResult, exerciseTargetLabel, freshWorkoutBlock, hasBlockActivity, TRAINING_BLOCK_LABELS, validateWorkoutBlock } from "../lib/training-blocks.ts";
import { normalizedBlocks, routineVersionSnapshot, validateBlock, validateRoutine, type BlockInput, type ExerciseInput, type RoutineInput } from "../lib/rutinas.ts";
import { routineSeriesMetrics } from "../lib/routine-metrics.ts";
import { validateWorkoutSessionInput } from "../lib/workout-session-validation.ts";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260802180000_add_training_routine_blocks/migration.sql", import.meta.url), "utf8");
const editor = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const student = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const blockTimer = readFileSync(new URL("../componentes/workout-block-timer.tsx", import.meta.url), "utf8");
const sessionApi = readFileSync(new URL("../app/api/portal/entrenamientos/route.ts", import.meta.url), "utf8");
const dataApi = readFileSync(new URL("../app/api/portal/data/route.ts", import.meta.url), "utf8");
const updateApi = readFileSync(new URL("../app/api/rutinas/[id]/route.ts", import.meta.url), "utf8");
const copyApi = readFileSync(new URL("../app/api/rutinas/[id]/duplicar/route.ts", import.meta.url), "utf8");

function exercise(overrides: Partial<ExerciseInput> = {}): ExerciseInput {
  return {
    name: "Sentadilla",
    muscleGroup: "Piernas",
    sets: 3,
    repetitions: "10",
    weight: 40,
    effortType: "RIR",
    effortValue: 2,
    restSeconds: 90,
    observations: "Técnica controlada",
    videoUrl: "",
    tempo: "3-1-1",
    alternativeExercise: "Goblet squat",
    equipment: "Barra",
    optional: false,
    targetType: "REPS",
    targetSeconds: null,
    targetRepetitions: "10",
    targetDistance: "",
    targetSide: "",
    order: 1,
    ...overrides,
  };
}

function block(type: BlockInput["type"], overrides: Partial<BlockInput> = {}): BlockInput {
  const defaults: Record<BlockInput["type"], Partial<BlockInput>> = {
    STRENGTH: {},
    ROUNDS: { rounds: 3, restSeconds: 20, restBetweenRoundsSeconds: 60 },
    INTERVAL: { rounds: 4, workSeconds: 40, restSeconds: 20 },
    EMOM: { durationSeconds: 720, targetRounds: 3 },
    AMRAP: { durationSeconds: 600 },
    FOR_TIME: { rounds: 3, durationSeconds: 900 },
    FREE: {},
  };
  return {
    type,
    name: TRAINING_BLOCK_LABELS[type],
    order: 1,
    rounds: null,
    durationSeconds: null,
    workSeconds: null,
    restSeconds: null,
    restBetweenRoundsSeconds: null,
    targetRounds: null,
    instructions: "Indicaciones",
    exercises: type === "STRENGTH" ? [exercise()] : [exercise({ sets: 1, weight: null, effortValue: null })],
    ...defaults[type],
    ...overrides,
  };
}

function routine(days: RoutineInput["days"]): RoutineInput {
  return {
    name: "Rutina mixta",
    kind: "assigned",
    description: "",
    objective: "Acondicionamiento",
    level: "intermedio",
    status: "activa",
    startDate: "2026-08-03",
    durationWeeks: 4,
    priorityMuscles: [],
    location: "Gimnasio",
    equipment: [],
    tags: [],
    studentIds: ["student-1"],
    days,
  };
}

test("una rutina anterior se interpreta como un único bloque STRENGTH sin duplicar ejercicios", () => {
  const legacyExercise = exercise({ id: "exercise-1", weight: 72.5 });
  const blocks = normalizedBlocks({ dayNumber: 1, name: "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: 50, exercises: [legacyExercise] });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "STRENGTH");
  assert.equal(blocks[0].exercises.length, 1);
  assert.equal(blocks[0].exercises[0], legacyExercise);
  assert.equal(blocks[0].exercises[0].weight, 72.5);
});

test("los siete tipos de bloque tienen nombre visible y configuración válida", () => {
  assert.deepEqual(Object.keys(TRAINING_BLOCK_LABELS), ["STRENGTH", "ROUNDS", "INTERVAL", "EMOM", "AMRAP", "FOR_TIME", "FREE"]);
  for (const type of Object.keys(TRAINING_BLOCK_LABELS) as BlockInput["type"][]) assert.equal(validateBlock(block(type)), null, type);
});

test("los objetivos por tiempo, repeticiones, distancia, descanso y libre se representan sin kg ni RIR", () => {
  assert.equal(exerciseTargetLabel(exercise({ targetType: "TIME", targetSeconds: 40 })), "40 segundos");
  assert.equal(exerciseTargetLabel(exercise({ targetType: "REPS", targetRepetitions: "12" })), "12 repeticiones");
  assert.equal(exerciseTargetLabel(exercise({ targetType: "DISTANCE", targetDistance: "200 m" })), "200 m");
  assert.equal(exerciseTargetLabel(exercise({ targetType: "REST", targetSeconds: 20 })), "Descanso · 20 segundos");
  assert.equal(exerciseTargetLabel(exercise({ targetType: "FREE" })), "Tarea libre");
  const blockCard = student.slice(student.indexOf("function WorkoutBlockCard"), student.indexOf("function WorkoutHistoryView"));
  assert.match(blockCard, /"ROUNDS"/);
  assert.doesNotMatch(blockCard, /RIR|RPE|kg/);
});

test("una rutina mixta, una de solo circuito y una de solo fuerza son válidas", () => {
  const day = (blocks: BlockInput[], exercises: ExerciseInput[] = []) => ({ dayNumber: 1, name: "Día 1", objective: "", warmup: "Movilidad", observations: "", estimatedMinutes: 45, exercises, blocks });
  assert.equal(validateRoutine(routine([day([block("STRENGTH"), block("ROUNDS", { order: 2 })])])), null);
  assert.equal(validateRoutine(routine([day([block("ROUNDS")])])), null);
  assert.equal(validateRoutine(routine([day([], [exercise()])])), null);
});

test("el snapshot conserva bloques, orden, entrada en calor y campos específicos", () => {
  const input = routine([{ dayNumber: 1, name: "Día 1", objective: "", warmup: "Movilidad\nActivación", observations: "", estimatedMinutes: 45, exercises: [], blocks: [block("AMRAP", { order: 2 }), block("STRENGTH", { order: 1 })] }]);
  const snapshot = routineVersionSnapshot(input);
  assert.equal(snapshot.days[0].warmup, "Movilidad\nActivación");
  assert.deepEqual(snapshot.days[0].blocks?.map((item) => item.type), ["STRENGTH", "AMRAP"]);
  assert.equal(snapshot.days[0].blocks?.[1].durationSeconds, 600);
});

test("cada tipo crea un borrador de resultado independiente", () => {
  for (const type of Object.keys(TRAINING_BLOCK_LABELS) as BlockInput["type"][]) {
    const programmed = { id: `block-${type}`, ...block(type) } as never;
    const draft = freshWorkoutBlock(programmed);
    assert.equal(draft.blockType, type);
    assert.equal(draft.result.completed, false);
    assert.deepEqual(draft.result.completedExerciseIds, []);
  }
});

test("AMRAP registra vueltas y extras; EMOM minutos; For time tiempo; libre texto", () => {
  const workout = (type: BlockInput["type"], changes: Partial<ReturnType<typeof emptyBlockResult>>) => ({ blockId: "b", blockName: "Bloque", blockType: type, blockOrder: 1, configuration: {}, exercises: [], result: { ...emptyBlockResult(), ...changes } });
  assert.equal(validateWorkoutBlock(workout("AMRAP", { roundsCompleted: 4, extraRepetitions: 6 })), null);
  assert.equal(validateWorkoutBlock(workout("EMOM", { minutesCompleted: 9 })), null);
  assert.equal(validateWorkoutBlock(workout("FOR_TIME", { completed: true, durationSeconds: 523 })), null);
  assert.equal(validateWorkoutBlock(workout("FREE", { completed: true, resultText: "Movilidad completa" })), null);
  assert.equal(hasBlockActivity(workout("ROUNDS", { roundsCompleted: 2 })), true);
});

test("la finalización acepta actividad de circuito sin exigir series de fuerza", () => {
  const session = {
    routineId: "r", routineName: "Rutina", dayId: "d", dayNumber: 1, date: "2026-08-03", startTime: "10:00", durationMinutes: 35,
    generalFeeling: "Buena" as const, finalComment: "", hasPain: false, painDetails: "", status: "finalizado" as const, exercises: [],
    blocks: [{ blockId: "b", blockName: "Circuito", blockType: "ROUNDS" as const, blockOrder: 1, configuration: {}, exercises: [], result: { ...emptyBlockResult(), roundsCompleted: 3 } }],
  };
  assert.equal(validateWorkoutSessionInput(session), null);
});

test("los circuitos no inflan series musculares y las métricas quedan separadas", () => {
  const metrics = routineSeriesMetrics({ days: [{ dayNumber: 1, exercises: [], blocks: [
    { type: "STRENGTH", durationSeconds: null, exercises: [{ muscleGroup: "Glúteos", sets: 4 }] },
    { type: "ROUNDS", durationSeconds: 600, rounds: 3, exercises: [{ muscleGroup: "Glúteos", sets: 99 }] },
    { type: "INTERVAL", durationSeconds: null, rounds: 3, workSeconds: 40, restSeconds: 20, exercises: [] },
  ] }] });
  assert.equal(metrics.totalSeries, 4);
  assert.equal(metrics.totalBlocks, 3);
  assert.equal(metrics.conditioningBlocks, 2);
  assert.equal(metrics.circuits, 1);
  assert.equal(metrics.programmedMinutes, 13);
});

test("la migración crea un bloque de fuerza por día y enlaza ejercicios sin tocar sesiones históricas", () => {
  assert.match(migration, /INSERT INTO "training_routine_blocks"/);
  assert.match(migration, /'STRENGTH'/);
  assert.match(migration, /WHERE NOT EXISTS/);
  assert.match(migration, /UPDATE "training_routine_exercises"/);
  assert.match(migration, /ALTER COLUMN "blockId" SET NOT NULL/);
  assert.doesNotMatch(migration, /DROP TABLE "WorkoutSession"|TRUNCATE|DELETE FROM "WorkoutSession"/);
});

test("Prisma normaliza bloques, objetivos y snapshots de resultados", () => {
  for (const model of ["TrainingRoutineBlock", "WorkoutBlockLog"]) assert.match(schema, new RegExp(`model ${model}`));
  for (const field of ["blockId", "targetType", "targetSeconds", "targetRepetitions", "targetDistance", "targetSide"]) assert.match(schema, new RegExp(field));
  assert.match(schema, /blockConfiguration\s+Json/);
  assert.match(schema, /exercisesSnapshot\s+Json/);
  assert.match(schema, /result\s+Json/);
});

test("el editor agrega, reordena, duplica y elimina bloques y ejercicios", () => {
  for (const text of ["+ Agregar bloque", "Fuerza", "Circuito", "Intervalos", "EMOM", "AMRAP", "For time", "Bloque libre", "+ Agregar ejercicio"]) assert.match(editor, new RegExp(text.replace("+", "\\+")));
  for (const handler of ["moveBlock", "duplicateBlock", "removeBlock", "moveExercise"]) assert.match(editor, new RegExp(handler));
  assert.match(editor, /if \(saving\) return/);
  assert.match(editor, /pb-\[calc\(env\(safe-area-inset-bottom\)/);
});

test("el portal ordena bloques, abre uno por vez y muestra el formulario según el tipo", () => {
  assert.match(student, /selectedDay\.blocks\.filter/);
  assert.match(student, /openBlockId === block\.blockId/);
  assert.match(student, /setOpenBlockId/);
  assert.match(student, /isTimedBlockType/);
  for (const type of ["INTERVAL", "EMOM", "AMRAP", "FOR_TIME"]) assert.match(blockTimer, new RegExp(`"${type}"`));
  for (const type of ["ROUNDS", "FREE"]) assert.match(student, new RegExp(`"${type}"`));
  assert.match(student, /Comenzar bloque/);
  assert.match(student, /overflow-hidden/);
});

test("las sesiones guardan snapshots y resultados por bloque sin romper la clave semanal", () => {
  assert.match(sessionApi, /workoutBlockLog/);
  assert.match(sessionApi, /blockConfiguration/);
  assert.match(sessionApi, /exercisesSnapshot/);
  assert.match(sessionApi, /result:/);
  assert.match(sessionApi, /getWorkoutWeekRange/);
  assert.match(sessionApi, /weeklySessionLockKey/);
  assert.match(dataApi, /blockType: log\.blockType/);
});

test("autoguardado no duplica sesiones y las finalizadas siguen inmutables", () => {
  assert.match(sessionApi, /existingSession/);
  assert.match(sessionApi, /existingSession\?\.status === "COMPLETED"/);
  assert.match(sessionApi, /Una sesión finalizada no puede modificarse ni reabrirse/);
  assert.match(sessionApi, /workoutSession\.update/);
  assert.doesNotMatch(sessionApi, /workoutSession\.createMany/);
});

test("actualizar una rutina activa conserva id, asignaciones, historial y protege bloques usados", () => {
  assert.match(updateApi, /existing\.status === "ACTIVA"/);
  assert.match(updateApi, /trainingRoutine\.update\(\{ where: \{ id \}/);
  assert.match(updateApi, /existingStudentIds/);
  assert.match(updateApi, /workoutLogs/);
  assert.match(updateApi, /trainingRoutineBlock\.update/);
  assert.match(updateApi, /active: false, archivedAt: new Date\(\)/);
  assert.doesNotMatch(updateApi, /workoutSession\.(?:update|delete)/);
});

test("duplicar, copiar y guardar como plantilla conservan bloques, ejercicios y entrada en calor", () => {
  for (const value of ["saveAsTemplate", "useTemplate", "copyToStudent", "warmup: day.warmup", "blocks: day.blocks.map", "targetType", "createRoutineDays"]) assert.match(copyApi, new RegExp(value));
  assert.match(updateApi, /restoreVersion/);
  assert.match(updateApi, /\.\.\.day/);
});
