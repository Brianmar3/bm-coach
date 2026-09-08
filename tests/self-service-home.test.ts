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
    "@/lib/prisma": { prisma: { workoutSession: { count: async (args: unknown) => { calls.push(args); return 0; } }, trainingRoutine: { findFirst: async () => null } } },
    "@/lib/self-service-account": { requireSelfServiceAccount: async () => ({ studentId: "own", student: { firstName: "Test", goal: "Ganar fuerza", experienceLevel: "Principiante" } }) },
    "@/lib/self-service": { selfServicePreferences: () => ({ availableDays: [1, 3, 5] }) },
    "@/lib/workout-week": { getWorkoutWeekRange: () => week },
    "@/lib/portal-service-access": { activePortalRoutineWhere: (studentId: string) => ({ assignments: { some: { studentId } } }) },
    "@/componentes/self-service-shell": { SelfServiceShell: "div" },
    "@/componentes/portal-visuals": { PortalHeroFrame: "header", PortalRoutineFrame: "section", PORTAL_STAT_CARD_CLASS: "stat" },
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
  assert.match(content, /Todavía no creaste una rutina/);
  assert.match(content, /entrenamientos esta semana/);
});

test("Home reemplaza el estado vacío por la rutina activa y su próximo día", async () => {
  const week = getWorkoutWeekRange("2026-09-08");
  const page = load("app/portal/autogestion/page.tsx", {
    "next/link": { default: "a" },
    "@/lib/prisma": { prisma: { workoutSession: { count: async () => 2 }, trainingRoutine: { findFirst: async () => ({ id: "routine-1", name: "Mi rutina real", days: [{ id: "day-1", dayNumber: 1, name: "Full body 1" }, { id: "day-2", dayNumber: 2, name: "Full body 2" }], workoutSessions: [{ dayId: "day-1" }] }) } } },
    "@/lib/self-service-account": { requireSelfServiceAccount: async () => ({ studentId: "own", student: { firstName: "Test", goal: "Ganar fuerza", experienceLevel: "Principiante" } }) },
    "@/lib/self-service": { selfServicePreferences: () => ({ availableDays: [1, 3] }) },
    "@/lib/workout-week": { getWorkoutWeekRange: () => week },
    "@/lib/portal-service-access": { activePortalRoutineWhere: (studentId: string) => ({ assignments: { some: { studentId } } }) },
    "@/componentes/self-service-shell": { SelfServiceShell: "div" },
    "@/componentes/portal-visuals": { PortalHeroFrame: "header", PortalRoutineFrame: "section", PORTAL_STAT_CARD_CLASS: "stat" },
    "@/componentes/icons": { BmTargetIcon: "i", BmRoutineIcon: "i", BmProgressIcon: "i" },
  });
  const content = JSON.stringify(await page.default());
  assert.match(content, /Mi rutina real/);
  assert.match(content, /Próximo: Día 2/);
  assert.match(content, /Entrenar ahora/);
  assert.doesNotMatch(content, /Todavía no creaste una rutina/);
});

test("comparte presentación con alumnos y conserva sólo tres destinos propios", () => {
  const shell = readFileSync("componentes/self-service-shell.tsx", "utf8");
  const coached = readFileSync("componentes/portal-shell.tsx", "utf8");
  for (const component of ["PortalHeader", "PortalNavigationLink", "PORTAL_MOBILE_NAV_CLASS"]) {
    assert.ok(shell.includes(component));
    assert.ok(coached.includes(component));
  }
  assert.equal((shell.match(/title: /g) || []).length, 3);
  const routine = readFileSync("app/portal/autogestion/rutina/page.tsx", "utf8");
  assert.match(routine, /SelfServiceRoutineWizard/);
  assert.doesNotMatch(routine, /Estamos preparando/);
  const profile = readFileSync("app/portal/autogestion/perfil/page.tsx", "utf8");
  for (const item of ["PortalProfileFrame", "PortalProfileAvatar", "Mi información", "Editar perfil", "SelfServiceAccountActions"]) assert.ok(profile.includes(item));
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
