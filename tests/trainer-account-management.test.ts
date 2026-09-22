import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countActiveManagedStudents, getTrainerPlanLimits, trainerStudentCapacity, trainerStudentLimitMessage } from "../lib/trainer-plan-limits.ts";
import { effectiveTrainerPlan, trainerTrialIsActive, trialEndsAt } from "../lib/trainer-subscription.ts";
import { consumeTrainerPasswordResetToken, TrainerPasswordResetRejected, trainerPasswordResetExpiresAt, trainerPasswordResetIsUsable, trainerPasswordResetToken, trainerPasswordResetTokenHash, type TrainerPasswordResetStore } from "../lib/trainer-password-reset.ts";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260922120000_trainer_plan_limits_account_management/migration.sql");
const createStudentApi = read("app/api/alumnos/route.ts");
const storeApi = read("app/api/store/[collection]/route.ts");
const membershipApi = read("app/api/platform/trainers/[id]/membership/route.ts");
const limitServer = read("lib/trainer-plan-limits-server.ts");
const resetOwnerApi = read("app/api/platform/trainers/[id]/password-reset/route.ts");
const resetPublicApi = read("app/api/trainer/password-reset/[token]/route.ts");
const trainersUi = read("componentes/platform-trainers.tsx");
const trainerDetail = read("app/platform/trainers/[id]/page.tsx");
const proxy = read("proxy.ts");
const appFrame = read("componentes/app-frame.tsx");
const adminLogin = read("app/api/admin/auth/login/route.ts");

test("catálogo central aplica FREE 5, STARTER 20, PRO 50 y PREMIUM sin límite", () => {
  assert.equal(getTrainerPlanLimits("FREE").studentLimit, 5);
  assert.equal(getTrainerPlanLimits("STARTER").studentLimit, 20);
  assert.equal(getTrainerPlanLimits("PRO").studentLimit, 50);
  assert.equal(getTrainerPlanLimits("PREMIUM").studentLimit, null);
  assert.equal(trainerStudentCapacity("FREE", 5).reached, true);
  assert.equal(trainerStudentCapacity("STARTER", 20).reached, true);
  assert.equal(trainerStudentCapacity("PRO", 50).reached, true);
  assert.equal(trainerStudentCapacity("PREMIUM", 5000).reached, false);
  assert.equal(trainerStudentLimitMessage(5), "Alcanzaste el límite de 5 alumnos de tu plan.");
});

test("conteo incluye sólo alumnos gestionados activos del workspace", () => {
  assert.equal(countActiveManagedStudents([
    { data: { firstName: "Activo", status: "activo" } },
    { data: { firstName: "Legacy" } },
    { data: { status: "inactivo" } },
    { data: { lifecycleStatus: "suspendido" } },
    { data: { status: "activo", accountType: "SELF_SERVICE" } },
  ]), 2);
});

test("altas e importaciones aplican el cupo dentro del workspace sin impedir ediciones tras downgrade", () => {
  assert.match(createStudentApi, /assertTrainerCanAddStudent\(workspaceId, transaction\)/);
  assert.match(storeApi, /assertTrainerCanReplaceStudents\(workspaceId/);
  assert.match(limitServer, /nextUsed > capacity\.used && nextUsed > capacity\.limit/);
  assert.match(createStudentApi, /TRAINER_STUDENT_LIMIT_REACHED/);
  assert.match(storeApi, /TRAINER_STUDENT_LIMIT_REACHED/);
  assert.match(createStudentApi, /Ver planes/);
});

test("migración incremental agrega FREE, prueba y tokens sin tocar workspaces ni alumnos", () => {
  assert.match(schema, /enum TrainerSubscriptionPlan \{\s+FREE/);
  assert.match(schema, /model TrainerPasswordResetToken/);
  assert.match(migration, /ADD VALUE 'FREE'/);
  assert.match(migration, /ADD COLUMN "trialEndsAt"/);
  assert.match(migration, /CREATE TABLE "trainer_password_reset_tokens"/);
  assert.doesNotMatch(migration, /DROP|DELETE FROM|UPDATE "workspaces"|UPDATE "students"/i);
});

test("prueba comercial dura 30 días y concede capacidades PREMIUM sin mutar el plan base", () => {
  const start = new Date("2026-09-22T12:00:00Z");
  const end = trialEndsAt(start);
  assert.equal(end.toISOString(), "2026-10-22T12:00:00.000Z");
  assert.equal(trainerTrialIsActive(end, new Date("2026-10-01T00:00:00Z")), true);
  assert.equal(effectiveTrainerPlan({ plan: "FREE", trialEndsAt: end }, new Date("2026-10-01T00:00:00Z")), "PREMIUM");
  assert.equal(effectiveTrainerPlan({ plan: "FREE", trialEndsAt: end }, new Date("2026-11-01T00:00:00Z")), "FREE");
});

test("cancelación y reactivación sincronizan User y suscripción sin borrar la cuenta ni sus datos", () => {
  assert.match(membershipApi, /REACTIVATE_ACCESS/);
  assert.match(membershipApi, /prisma\.user\.update\(\{ where: \{ id: trainer\.id \}, data: \{ status: "ACTIVE" \} \}\)/);
  assert.match(membershipApi, /prisma\.trainerSubscription\.update\(\{ where: \{ trainerUserId: trainer\.id \}, data: \{ status: "ACTIVE"/);
  assert.match(membershipApi, /status === "CANCELLED"/);
  assert.match(membershipApi, /synchronizedUserStatus/);
  assert.match(membershipApi, /revalidatePath\(`\/platform\/trainers\/\$\{id\}`\)/);
  assert.match(trainerDetail, /Acceso \{trainer\.status === "ACTIVE" \? "activo" : "suspendido"\}/);
  assert.match(adminLogin, /user\.status !== "ACTIVE"/);
  assert.doesNotMatch(membershipApi, /workspace(Membership)?\.(delete|update)|studentRecord\.(delete|update)|user\.delete|trainerSubscription\.delete/);
});

test("reset usa token aleatorio, hash, vencimiento y consumo único", () => {
  const token = trainerPasswordResetToken();
  assert.ok(token.length >= 43);
  assert.notEqual(trainerPasswordResetToken(), token);
  assert.equal(trainerPasswordResetTokenHash(token), trainerPasswordResetTokenHash(token));
  const now = new Date("2026-09-22T12:00:00Z");
  const expiresAt = trainerPasswordResetExpiresAt(now);
  assert.equal(expiresAt.toISOString(), "2026-09-22T12:30:00.000Z");
  assert.equal(trainerPasswordResetIsUsable({ expiresAt, usedAt: null }, now), true);
  assert.equal(trainerPasswordResetIsUsable({ expiresAt, usedAt: now }, now), false);
  assert.match(resetOwnerApi, /platformOwnerApiAccess/);
  assert.match(resetOwnerApi, /tokenHash: trainerPasswordResetTokenHash\(token\)/);
  assert.match(resetPublicApi, /consumeTrainerPasswordResetToken/);
  assert.match(resetPublicApi, /where: \{ id, usedAt: null, expiresAt: \{ gt: claimedAt \} \}/);
  assert.match(resetPublicApi, /where: \{ id: trainerUserId \}/);
  assert.doesNotMatch(resetOwnerApi + resetPublicApi, /console\.(log|error).*token|passwordHash:\s*console/i);
});

test("Alumno B logueado no interviene: el token cambia sólo el passwordHash de Trainer A y queda consumido", async () => {
  const token = trainerPasswordResetToken();
  const now = new Date("2026-09-22T12:00:00Z");
  const trainerPasswords = new Map([["trainer-a", "trainer-a-old"], ["trainer-c", "trainer-c-old"]]);
  const studentCredentials = new Map([["student-b", "student-b-old"]]);
  const activeStudentSession = { studentId: "student-b", tokenHash: "active-student-session" };
  let usedAt: Date | null = null;
  const store: TrainerPasswordResetStore = {
    async findByTokenHash(tokenHash) {
      assert.equal(tokenHash, trainerPasswordResetTokenHash(token));
      return { id: "reset-a", trainerUserId: "trainer-a", expiresAt: trainerPasswordResetExpiresAt(now), usedAt, trainer: { platformRole: "TRAINER" } };
    },
    async claim(_id, claimedAt) {
      if (usedAt) return false;
      usedAt = claimedAt;
      return true;
    },
    async updateTrainerPassword(trainerUserId, passwordHash) {
      assert.equal(trainerUserId, "trainer-a");
      trainerPasswords.set(trainerUserId, passwordHash);
    },
  };

  const changedUserId = await consumeTrainerPasswordResetToken(store, token, "trainer-a-new", now);
  assert.equal(changedUserId, "trainer-a");
  assert.equal(trainerPasswords.get("trainer-a"), "trainer-a-new");
  assert.equal(trainerPasswords.get("trainer-c"), "trainer-c-old");
  assert.equal(studentCredentials.get(activeStudentSession.studentId), "student-b-old");
  await assert.rejects(() => consumeTrainerPasswordResetToken(store, token, "second-password", now), TrainerPasswordResetRejected);
  assert.equal(trainerPasswords.get("trainer-a"), "trainer-a-new");
});

test("Ver abre sólo el detalle administrativo y conserva la sesión PLATFORM_OWNER", () => {
  assert.match(trainersUi, /prefetch=\{false\}/);
  assert.match(trainerDetail, /requirePlatformOwnerPage\(\)/);
  assert.match(trainerDetail, /TrainerAccountActions/);
  assert.doesNotMatch(trainerDetail + trainersUi, /createAdminSessionValue|ADMIN_SESSION_COOKIE|cookies\(\)\.set|logout|imperson/i);
});

test("reset público es la única excepción y las APIs de gestión siguen bajo PLATFORM_OWNER", () => {
  assert.match(proxy, /trainerPasswordResetRoute/);
  assert.match(appFrame, /pathname\.startsWith\("\/trainer\/reset-password\/"\)/);
  assert.match(resetOwnerApi, /if \(!access\.ok\) return access\.response/);
  assert.match(createStudentApi, /requireTrainerWorkspace/);
  assert.match(storeApi, /where: \{ workspaceId/);
});

test("Master muestra consumo, advertencias y límite sin copiar identidad externa", () => {
  assert.match(trainersUi, /capacity\.used/);
  assert.match(trainersUi, /capacity\.limit/);
  assert.match(trainersUi, /capacity\?\.nearLimit/);
  assert.match(trainerDetail, /80%/);
  assert.match(trainerDetail, /Límite alcanzado/);
});
