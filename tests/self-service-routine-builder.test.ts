import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { BMExercise } from "../types/exercise-library.ts";
import { generateSelfServiceRoutineProposal } from "../lib/self-service-routine-proposal.ts";
import { selfServiceProposalError, selfServiceRoutineInput } from "../lib/self-service-routine-persistence.ts";

const library = JSON.parse(readFileSync(new URL("../data/bm-exercise-library.json", import.meta.url), "utf8")) as BMExercise[];
const base = { objective: "Ganar masa muscular", level: "Principiante" as const, daysPerWeek: 3, sessionMinutes: 45, trainingLocation: "Gimnasio", equipment: ["Peso corporal", "Mancuernas"], priorityMuscle: "", variation: 0 };

test("genera una propuesta determinista con ejercicios reales de Biblioteca BM", () => {
  const first = generateSelfServiceRoutineProposal(base, library);
  const second = generateSelfServiceRoutineProposal(base, library);
  assert.deepEqual(first, second);
  assert.equal(first.days.length, 3);
  assert.ok(first.days.every((day) => day.exercises.length === 5));
  const libraryIds = new Set(library.map((item) => item.id));
  assert.ok(first.days.flatMap((day) => day.exercises).every((exercise) => libraryIds.has(exercise.libraryId)));
  assert.match(first.summary, /3 días · 45 min · Ganar masa muscular/);
});

test("adapta estructura, volumen y descanso a frecuencia, duración, nivel y objetivo", () => {
  const four = generateSelfServiceRoutineProposal({ ...base, daysPerWeek: 4, sessionMinutes: 30 }, library);
  assert.deepEqual(four.days.map((day) => day.name), ["Tren superior A", "Tren inferior A", "Tren superior B", "Tren inferior B"]);
  assert.ok(four.days.every((day) => day.exercises.length === 4));
  const strength = generateSelfServiceRoutineProposal({ ...base, objective: "Ganar fuerza", level: "Avanzado", sessionMinutes: 60 }, library);
  const compounds = strength.days.flatMap((day) => day.exercises).filter((exercise) => !["core", "calves", "pushAccessory", "pullAccessory", "lowerAccessory", "gluteAccessory"].includes(exercise.pattern));
  const accessories = strength.days.flatMap((day) => day.exercises).filter((exercise) => !compounds.includes(exercise));
  assert.ok(compounds.every((exercise) => exercise.sets === 4 && exercise.repetitions === "6-8" && exercise.restSeconds === 180));
  assert.ok(accessories.every((exercise) => exercise.sets === 3 && exercise.restSeconds === 75));
  const conditioning = generateSelfServiceRoutineProposal({ ...base, objective: "Bajar grasa" }, library);
  assert.ok(conditioning.days.flatMap((day) => day.exercises).every((exercise) => exercise.restSeconds <= 90));
});

test("genera un plan real de hipertrofia principiante de cinco días equilibrado", () => {
  const answers = { ...base, daysPerWeek: 5, sessionMinutes: 60, equipment: ["Peso corporal", "Mancuernas", "Barra y discos", "Máquinas", "Banco"], priorityMuscle: "Espalda" };
  const proposal = generateSelfServiceRoutineProposal(answers, library);
  assert.deepEqual(proposal.days.map((day) => day.name), ["Tren superior", "Tren inferior", "Empuje", "Tirón", "Piernas"]);
  assert.ok(proposal.days.every((day) => day.exercises.length >= 4 && day.exercises.length <= 6));
  const exercises = proposal.days.flatMap((day) => day.exercises);
  const patterns = new Set(exercises.map((exercise) => exercise.pattern));
  for (const pattern of ["knee", "hinge", "horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "core", "calves"]) assert.ok(patterns.has(pattern as typeof exercises[number]["pattern"]), pattern);
  assert.equal(new Set(exercises.map((exercise) => exercise.libraryId)).size, exercises.length);
  assert.equal(new Set(exercises.map((exercise) => exercise.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())).size, exercises.length);
  for (const day of proposal.days) {
    const firstAccessory = day.exercises.findIndex((exercise) => ["core", "calves", "pushAccessory", "pullAccessory", "lowerAccessory", "gluteAccessory"].includes(exercise.pattern));
    if (firstAccessory >= 0) assert.ok(day.exercises.slice(0, firstAccessory).every((exercise) => !["core", "calves"].includes(exercise.pattern)));
  }
  assert.ok(exercises.some((exercise) => exercise.restSeconds === 120));
  assert.ok(exercises.some((exercise) => exercise.restSeconds === 75));
  const input = selfServiceRoutineInput("self-real-case", answers, proposal, library, "2026-09-08");
  assert.equal(input.days.length, 5);
  assert.deepEqual(input.studentIds, ["self-real-case"]);
  assert.ok(input.days.every((day) => day.blocks?.[0]?.exercises.length === 6));
});

test("respeta el equipamiento declarado y una variación cambia ejercicios", () => {
  const bodyweight = generateSelfServiceRoutineProposal({ ...base, equipment: ["Peso corporal"] }, library);
  assert.ok(bodyweight.days.flatMap((day) => day.exercises).every((exercise) => ["Peso corporal", "Asistido"].includes(exercise.equipment)));
  const alternate = generateSelfServiceRoutineProposal({ ...base, equipment: ["Peso corporal"], variation: 1 }, library);
  assert.notDeepEqual(bodyweight.days.flatMap((day) => day.exercises).map((item) => item.libraryId), alternate.days.flatMap((day) => day.exercises).map((item) => item.libraryId));
});

test("wizard resume onboarding, permite editar y activa con una sola navegación estable", () => {
  const page = readFileSync(new URL("../app/portal/autogestion/rutina/page.tsx", import.meta.url), "utf8");
  const wizard = readFileSync(new URL("../componentes/self-service-routine-wizard.tsx", import.meta.url), "utf8");
  const api = readFileSync(new URL("../app/api/portal/autogestion/rutina/propuesta/route.ts", import.meta.url), "utf8");
  assert.match(page, /selfServicePreferences\(student\)/);
  assert.match(page, /student\.goal/);
  assert.match(page, /student\.experienceLevel/);
  assert.match(page, /student\.hasLimitations/);
  for (const label of ["Vamos a crear tu rutina con estos datos", "Objetivo", "Nivel", "Frecuencia", "Duración", "Lugar", "Equipamiento", "Generar mi rutina", "Editar datos"]) assert.ok(wizard.includes(label), label);
  assert.match(wizard, /useState\(false\)/);
  for (const label of ["Confirmá tu objetivo", "Confirmá tu nivel", "Días por semana", "Duración por sesión", "Lugar y equipamiento", "Prioridad muscular", "Tu rutina sugerida"]) assert.ok(wizard.includes(label));
  assert.match(wizard, /Usar esta rutina/);
  assert.match(wizard, /activating \|\| loading/);
  assert.match(wizard, /fetch\("\/api\/portal\/autogestion\/rutina"/);
  assert.match(wizard, /window\.location\.replace\("\/portal\/autogestion\/rutina"\)/);
  assert.doesNotMatch(wizard, /router\.refresh|useRouter/);
  assert.match(api, /requireSelfServiceAccount\(\)/);
  assert.match(api, /loadExerciseLibrary\(\)/);
  assert.doesNotMatch(api, /trainingRoutine\.(create|update)|\$transaction/);
});

test("convierte la propuesta editada en la estructura relacional del reproductor", () => {
  const proposal = generateSelfServiceRoutineProposal(base, library);
  proposal.days[0].exercises[0] = { ...proposal.days[0].exercises[0], sets: 5, repetitions: "8–12", restSeconds: 105 };
  const input = selfServiceRoutineInput("self-1", base, proposal, library, "2026-09-08");
  assert.equal(input.kind, "assigned");
  assert.equal(input.status, "activa");
  assert.deepEqual(input.studentIds, ["self-1"]);
  assert.equal(input.days.length, 3);
  assert.ok(input.days.every((day) => day.blocks?.length === 1 && day.blocks[0].type === "STRENGTH"));
  const exercise = input.days[0].blocks![0].exercises[0];
  assert.equal(exercise.sets, 5);
  assert.equal(exercise.repetitions, "8-12");
  assert.equal(exercise.restSeconds, 105);
  assert.equal(exercise.effortType, "RIR");
  assert.equal(input.tags[0], "SELF_SERVICE_OWNED");
});

test("rechaza ediciones corruptas y ejercicios ajenos a Biblioteca BM", () => {
  const proposal = generateSelfServiceRoutineProposal(base, library);
  proposal.days[0].exercises[0].sets = 0;
  assert.match(selfServiceProposalError(proposal) ?? "", /series/i);
  proposal.days[0].exercises[0].sets = 3;
  proposal.days[0].exercises[0].libraryId = "otro-usuario";
  assert.throws(() => selfServiceRoutineInput("self-1", base, proposal, library, "2026-09-08"), /Biblioteca BM/);
});

test("persistencia es transaccional, idempotente y archiva sin borrar historial", () => {
  const route = readFileSync(new URL("../app/api/portal/autogestion/rutina/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireSelfServiceAccount\(\)/);
  assert.match(route, /\$transaction/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /versions: \{ some: \{ fingerprint \} \}/);
  assert.match(route, /reused: true/);
  assert.match(route, /trainingRoutineAssignment\.updateMany/);
  assert.match(route, /status: "ARCHIVADA"/);
  assert.doesNotMatch(route, /workoutSession\.(delete|deleteMany)/);
  assert.match(route, /createRoutineDays/);
  assert.match(route, /trainingRoutineVersion\.create/);
});

test("pantalla elige creador sin rutina y reproductor existente con rutina activa", () => {
  const page = readFileSync(new URL("../app/portal/autogestion/rutina/page.tsx", import.meta.url), "utf8");
  const player = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  assert.match(page, /hasActivePortalRoutine\(studentId\)/);
  assert.match(page, /PortalSection section="rutina"/);
  assert.match(page, /dataEndpoint="\/api\/portal\/autogestion\/rutina" selfService/);
  for (const expected of ["Kg de la serie", "Reps de la serie", "RIR", "ExerciseRestTimer", "Finalizar entrenamiento"]) assert.ok(player.includes(expected), expected);
});

test("sesiones propias alimentan historial y no disparan notificación al entrenador", () => {
  const workout = readFileSync(new URL("../app/api/portal/entrenamientos/route.ts", import.meta.url), "utf8");
  const data = readFileSync(new URL("../app/api/portal/autogestion/rutina/route.ts", import.meta.url), "utf8");
  assert.match(workout, /getPortalSession\(\{ allowSelfService: true \}\)/);
  assert.match(workout, /studentId: session\.studentId/);
  assert.match(workout, /!isSelfService\(student\).*isWorkoutTrainerNotificationEligible/);
  assert.match(data, /workoutSession\.findMany\(\{ where: \{ studentId \}/);
  assert.match(data, /serializePortalWorkoutSessions/);
});

test("Evaluaciones filtra SELF_SERVICE en query y read model", () => {
  const api = readFileSync(new URL("../app/api/admin/evaluaciones/progreso/route.ts", import.meta.url), "utf8");
  const filter = readFileSync(new URL("../lib/evaluation-student-filter.ts", import.meta.url), "utf8");
  assert.match(api, /where: coachedStudentsWhere/);
  assert.match(api, /accountType: data\.accountType === "SELF_SERVICE"/);
  assert.match(filter, /student\.accountType === "SELF_SERVICE"/);
});
