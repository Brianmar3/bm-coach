import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMuscleGroup, routineSeriesMetrics } from "../lib/routine-metrics.ts";

const routine = {
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      name: "Tren inferior",
      exercises: [
        { muscleGroup: "Glúteo", sets: 4 },
        { muscleGroup: "Cuadriceps", sets: 3 },
        { muscleGroup: "", sets: 2 },
      ],
    },
    {
      id: "day-2",
      dayNumber: 2,
      name: "Espalda",
      exercises: [
        { muscleGroup: "Dorsales", sets: 5 },
        { muscleGroup: "Bíceps", sets: 2 },
      ],
    },
    { id: "day-3", dayNumber: 3, name: "Descanso", exercises: [] },
  ],
};

test("calcula una sola vez días, ejercicios y series configuradas", () => {
  const metrics = routineSeriesMetrics(routine);
  assert.equal(metrics.totalDays, 3);
  assert.equal(metrics.activeDays, 2);
  assert.equal(metrics.totalExercises, 5);
  assert.equal(metrics.totalSeries, 16);
});

test("normaliza zonas reales sin perder grupos desconocidos", () => {
  assert.equal(normalizeMuscleGroup("Glúteos"), "Glúteos");
  assert.equal(normalizeMuscleGroup("isquiotibiales"), "Isquios");
  assert.equal(normalizeMuscleGroup("Dorsal"), "Espalda");
  assert.equal(normalizeMuscleGroup(""), "Sin clasificar");
  assert.equal(normalizeMuscleGroup("Movilidad"), "Movilidad");
});

test("ordena la distribución semanal por volumen y conserva el desglose diario", () => {
  const metrics = routineSeriesMetrics(routine);
  assert.deepEqual(metrics.weeklyDistribution.map((item) => [item.muscleGroup, item.series]), [
    ["Espalda", 5],
    ["Glúteos", 4],
    ["Cuádriceps", 3],
    ["Bíceps", 2],
    ["Sin clasificar", 2],
  ]);
  assert.equal(metrics.perDay[0].totalSeries, 9);
  assert.equal(metrics.perDay[2].totalSeries, 0);
});

test("tolera series inválidas y rutinas vacías sin inventar volumen", () => {
  assert.equal(routineSeriesMetrics({ days: [{ dayNumber: 1, exercises: [{ sets: Number.NaN }, { sets: 0 }, { sets: -3 }] }] }).totalSeries, 0);
  assert.deepEqual(routineSeriesMetrics({ days: [] }), {
    totalDays: 0,
    activeDays: 0,
    totalExercises: 0,
    totalSeries: 0,
    totalBlocks: 0,
    conditioningBlocks: 0,
    circuits: 0,
    programmedMinutes: 0,
    weeklyDistribution: [],
    perDay: [],
  });
});
