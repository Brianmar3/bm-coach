import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { trainerStudentCapacity } from "../lib/trainer-plan-limits.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("upgrade y downgrade cambian límites sin conservar el plan de alta", () => {
  assert.equal(trainerStudentCapacity("STARTER", 25).reached, true);
  assert.equal(trainerStudentCapacity("PREMIUM", 25).reached, false);
  assert.equal(trainerStudentCapacity("STARTER", 25).reached, true);
  const membershipApi = read("app/api/platform/trainers/[id]/membership/route.ts");
  assert.match(membershipApi, /planChanged = existing\?\.plan !== plan/);
  assert.match(membershipApi, /planChanged \? \{ trialEndsAt: null \}/);
});

test("branding y cupos comparten una única fuente de verdad viva", () => {
  const entitlement = read("lib/workspace-entitlements-server.ts");
  const branding = read("lib/workspace-branding-server.ts");
  const limits = read("lib/trainer-plan-limits-server.ts");
  assert.match(entitlement, /where: \{[^]*workspaceId,[^]*role: "OWNER"[^]*status: "ACTIVE"/);
  assert.match(entitlement, /trainerSubscription:[^]*plan: true/);
  assert.match(entitlement, /orderBy: \{ createdAt: "asc" \}/);
  assert.match(branding, /loadWorkspaceTrainerPlan\(workspaceId\)/);
  assert.match(limits, /loadWorkspaceTrainerPlan\(workspaceId, client\)/);
  assert.doesNotMatch(entitlement, /unstable_cache|use cache|globalThis/);
});

test("el cambio sólo toca la suscripción del trainer solicitado", () => {
  const membershipApi = read("app/api/platform/trainers/[id]/membership/route.ts");
  assert.match(membershipApi, /where: \{ trainerUserId: trainer\.id \}/);
  assert.doesNotMatch(membershipApi, /trainerSubscription\.updateMany|workspace\.updateMany/);
  for (const path of ["/dashboard", "/configuracion", "/alumnos"]) {
    assert.match(membershipApi, new RegExp(`revalidatePath\\(\"${path}\"\\)`));
  }
});
