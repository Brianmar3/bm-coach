import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanRoutineDisplayName, completedExerciseCount, initialOpenExerciseId, usefulDayName, workoutAreaFromText } from "../lib/workout-presentation.ts";

const source = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");

test("el encabezado limpia copias y evita repetir el nombre del día", () => {
  assert.equal(cleanRoutineDisplayName(" Rutina Juani nueva (copia) "), "Rutina Juani nueva");
  assert.equal(cleanRoutineDisplayName("Rutina base - copia"), "Rutina base");
  assert.equal(usefulDayName(1, "Día 1"), "");
  assert.equal(usefulDayName(1, "Glúteos"), "Glúteos");
  assert.match(source, /routineDisplayName/);
  assert.doesNotMatch(source, /<h1[^>]*>Día \{selectedDay\.dayNumber\}/);
});

test("el selector horizontal funciona con cualquier cantidad de días", () => {
  assert.match(source, /trainingDays\.map/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /aria-pressed/);
});

test("el resumen usa ejercicios reales, duración, estado y progreso", () => {
  assert.equal(completedExerciseCount([{ exerciseId: "a", sets: [{ completed: true }] }, { exerciseId: "b", sets: [{ completed: false }] }]), 1);
  for (const value of ["ejercicios completados", "Día sugerido", "Sin comenzar", "En curso", "Completado"]) assert.match(source, new RegExp(value));
  assert.match(source, /conic-gradient\(#facc15/);
  assert.match(source, /completados<\/small>/);
  assert.match(source, /min duración/);
});

test("el hero elige un contexto visual según la zona muscular", () => {
  assert.equal(workoutAreaFromText("Glúteos y cuádriceps"), "lower");
  assert.equal(workoutAreaFromText("Pecho"), "chest");
  assert.equal(workoutAreaFromText("Espalda y dorsales"), "back");
  assert.equal(workoutAreaFromText("Hombros"), "shoulders");
  assert.equal(workoutAreaFromText("Bíceps y tríceps"), "arms");
  assert.equal(workoutAreaFromText("Core abdominal"), "core");
  assert.equal(workoutAreaFromText("Movilidad general"), "general");
  assert.match(source, /<WorkoutAreaIcon area=\{workoutArea\}/);
});

test("abre el primer ejercicio incompleto y mantiene un único acordeón controlado", () => {
  const exercises = [
    { exerciseId: "done", sets: [{ completed: true }] },
    { exerciseId: "current", sets: [{ completed: true }, { completed: false }] },
  ];
  assert.equal(initialOpenExerciseId(exercises), "current");
  assert.match(source, /openExerciseId === exercise\.exerciseId/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /setOpenExerciseId\(open \? null : exercise\.exerciseId\)/);
});

test("contraer no elimina el borrador ni cambia el guardado existente", () => {
  assert.match(source, /updateSet\(exerciseIndex, setIndex/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /fetch\("\/api\/portal\/entrenamientos"/);
});

test("la tabla compacta conserva Kg, Reps, esfuerzo, valores y checkbox accesible", () => {
  assert.match(source, /grid-cols-\[2\.25rem_minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)_2\.5rem\]/);
  assert.match(source, /value=\{set\.weight \?\? ""\}/);
  assert.match(source, /value=\{set\.repetitions \?\? ""\}/);
  assert.match(source, /value=\{set\.effort \?\? ""\}/);
  assert.match(source, /Serie \$\{set\.setNumber\} completada/);
});

test("técnica y video aparecen únicamente cuando existe contenido", () => {
  assert.match(source, /programmed\?\.observations \|\| programmed\?\.videoUrl/);
  assert.match(source, /Ver técnica/);
  assert.match(source, /Abrir video técnico/);
  assert.doesNotMatch(source, /autoPlay/);
});

test("las acciones mantienen handlers y aparecen después de los ejercicios", () => {
  assert.match(source, /onClick=\{\(\) => save\(false\)\}/);
  assert.match(source, /onClick=\{openFinalSummary\}/);
  assert.match(source, /disabled=\{saving \|\| !started\}/);
  assert.doesNotMatch(source, /fixed inset-x-3 bottom-/);
  assert.match(source, /mt-5 grid grid-cols-2/);
  assert.match(source, /max-\[340px\]:grid-cols-1/);
});

test("el historial vacío muestra un único mensaje", () => {
  assert.doesNotMatch(source, /Sin sesiones registradas/);
  assert.equal(source.match(/Todavía no hay entrenamientos registrados\./g)?.length, 1);
});
