import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { profileDate, profileMeasurement } from "../lib/self-service-presentation.ts";
import { getWorkoutWeekRange } from "../lib/workout-week.ts";

const nativeRequire = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name), Date });
  return loaded.exports as Record<string, (...args: any[]) => any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
test("guarda la navegación propia: sin sesión login, pendiente onboarding, completo Home", async () => {
  let session: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const auth = load("lib/self-service-account.ts", {
    "next/navigation": { redirect: (path: string) => { throw new Error(path); } },
    "@/lib/portal-auth": { getPortalSession: async () => session },
    "@/lib/self-service": { isSelfService: (data: { accountType?: string }) => data.accountType === "SELF_SERVICE" },
    "@/lib/student-onboarding": { onboardingIsComplete: (data: { onboardingCompleted?: boolean }) => data.onboardingCompleted === true },
  });
  await assert.rejects(auth.requireSelfServiceAccount(), /\/portal\/login/);
  session = { studentId: "own", credential: { student: { data: { accountType: "SELF_SERVICE" } } } };
  await assert.rejects(auth.requireSelfServiceAccount(), /\/portal\/onboarding/);
  session.credential.student.data.onboardingCompleted = true;
  assert.equal((await auth.requireSelfServiceAccount()).studentId, "own");
  for (const serviceType of ["CLASSES", "PERSONALIZED", "MIXED"]) {
    session.credential.student.data = { serviceType, onboardingCompleted: true };
    await assert.rejects(auth.requireSelfServiceAccount(), { message: "/portal" });
  }
});
test("fecha sin desplazamiento horario y unidades sólo de presentación", () => {
  assert.equal(profileDate("2026-09-07"), "07/09/2026");
  assert.equal(profileDate(""), "—");
  assert.equal(profileMeasurement(166, "cm"), "166 cm");
  assert.equal(profileMeasurement(70, "kg"), "70 kg");
  assert.equal(profileMeasurement(70.5, "kg"), "70,5 kg");
});
test("Home consulta únicamente sesiones completadas propias y la semana real", async () => {
  const calls: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const week = getWorkoutWeekRange("2026-09-08");
  const page = load("app/portal/autogestion/page.tsx", {
    "next/link": { default: "a" },
    "@/lib/prisma": { prisma: { workoutSession: { count: async (args: unknown) => { calls.push(args); return 0; } } } },
    "@/lib/self-service-account": { requireSelfServiceAccount: async () => ({ studentId: "own", student: { firstName: "Test", goal: "Ganar fuerza", experienceLevel: "Principiante" } }) },
    "@/lib/self-service": { selfServicePreferences: () => ({ availableDays: [1, 3, 5] }) },
    "@/lib/workout-week": { getWorkoutWeekRange: () => week },
    "@/componentes/self-service-shell": { SelfServiceShell: "div" },
    "@/componentes/icons": { BmTargetIcon: "i", BmRoutineIcon: "i", BmProgressIcon: "i" },
  });
  const tree = await page.default();
  assert.equal(calls.length, 2);
  for (const call of calls) { assert.equal(call.where.studentId, "own"); assert.equal(call.where.status, "COMPLETED"); }
  assert.equal(calls[0].where.date.gte.toISOString().slice(0, 10), "2026-09-07");
  assert.equal(calls[0].where.date.lt.toISOString().slice(0, 10), "2026-09-14");
  const content = JSON.stringify(tree);
  assert.match(content, /Tu entrenamiento empieza acá/);
  assert.match(content, /Ganar fuerza/);
  assert.match(content, /entrenamientos esta semana/);
});
test("confirmación breve y redirect existentes apuntan al Home, no al perfil", () => {
  const onboarding = readFileSync("componentes/student-onboarding.tsx", "utf8");
  assert.match(onboarding, /Perfil completado/);
  assert.match(onboarding, /Ir a BM Training/);
  assert.match(onboarding, /router.replace\(selfService \? "\/portal\/autogestion" : "\/portal"\)/);
  assert.match(readFileSync("lib/portal-auth.ts", "utf8"), /isSelfService.*redirect\("\/portal\/autogestion"\)/);
  const home = readFileSync("app/portal/autogestion/page.tsx", "utf8");
  assert.doesNotMatch(home, /<dl|student.email|todavía no está disponible/);
  assert.match(home, /href="\/portal\/autogestion\/rutina"/);
});
test("Mi información conserva los campos y editar usa el mismo onboarding", () => {
  const info = readFileSync("app/portal/autogestion/perfil/informacion/page.tsx", "utf8");
  for (const field of ["student.email", "student.phone", "student.birthDate", "student.height", "student.weight", "student.goal", "student.experienceLevel", "student.trainingExperience", "prefs.availableDays", "prefs.sessionMinutes", "prefs.trainingLocation", "prefs.equipment", "student.limitations"]) assert.ok(info.includes(field), field);
  assert.match(info, /Editar mi perfil/);
  assert.match(info, /SelfServiceAccountActions/);
  assert.match(readFileSync("app/portal/autogestion/perfil/editar/page.tsx", "utf8"), /StudentOnboarding selfService/);
});
test("la navegación no habilita APIs ni secciones de alumnos del entrenador", () => {
  const shell = readFileSync("componentes/self-service-shell.tsx", "utf8");
  assert.doesNotMatch(shell, /\/portal\/(clases|pagos|asistencias|nutricion|evaluaciones)|QuickNoteButton|AchievementCelebration/);
  assert.match(shell, /safe-area-inset-bottom/);
  assert.match(shell, /aria-current/);
  for (const path of ["page.tsx", "perfil/page.tsx", "perfil/informacion/page.tsx", "perfil/editar/page.tsx", "rutina/page.tsx"]) assert.match(readFileSync(`app/portal/autogestion/${path}`, "utf8"), /requireSelfServiceAccount\(\)/);
});
