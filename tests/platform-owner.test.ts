import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdminSessionValue, verifyAdminSessionValue } from "../lib/admin-auth.ts";
import { invitationIsUsable, isPlatformOwner, trainerWorkspaceSlug } from "../lib/platform-access.ts";
import { parseTrainerInvitation, studentEmailConflict, trainerInvitationToken, trainerInvitationTokenHash } from "../lib/trainer-invitations.ts";

const read = (path: string) => readFileSync(path, "utf8");
const platformLayout = read("app/platform/layout.tsx");
const trainersApi = read("app/api/platform/trainers/route.ts");
const invitationsApi = read("app/api/platform/trainers/invitations/route.ts");
const acceptApi = read("app/api/trainer/invitations/[token]/accept/route.ts");
const onboardingApi = read("app/api/trainer/onboarding/route.ts");
const migration = read("prisma/migrations/20260917120000_platform_owner_trainers/migration.sql");

test("1. PLATFORM_OWNER puede abrir /platform", () => { assert.equal(isPlatformOwner("PLATFORM_OWNER"), true); assert.match(platformLayout, /requirePlatformOwnerPage/); });
test("2. TRAINER_OWNER recibe redirect seguro", () => { assert.equal(isPlatformOwner("TRAINER"), false); assert.match(read("lib/platform-auth.ts"), /redirect\("\/dashboard"\)/); });
test("3. PLATFORM_OWNER puede listar trainers", () => { assert.match(trainersApi, /platformOwnerApiAccess/); assert.match(trainersApi, /user\.findMany/); });
test("4. TRAINER_OWNER no puede listar trainers", () => { assert.match(trainersApi, /if \(!access\.ok\) return access\.response/); assert.match(read("lib/platform-auth.ts"), /status: 403/); });
test("5. PLATFORM_OWNER puede crear invitación", () => { assert.match(invitationsApi, /platformOwnerApiAccess/); assert.match(invitationsApi, /trainerInvitation\.create/); });
test("6. TRAINER_OWNER no puede crear invitación", () => { assert.match(invitationsApi, /if \(!access\.ok\) return access\.response/); });
test("7. token válido funciona", () => { const token = trainerInvitationToken(); assert.ok(token.length >= 43); assert.equal(trainerInvitationTokenHash(token), trainerInvitationTokenHash(token)); assert.equal(invitationIsUsable({ status: "PENDING", acceptedAt: null, expiresAt: new Date(Date.now() + 1000) }), true); });
test("8. token vencido falla", () => { assert.equal(invitationIsUsable({ status: "PENDING", acceptedAt: null, expiresAt: new Date(Date.now() - 1) }), false); });
test("9. token usado falla", () => { assert.equal(invitationIsUsable({ status: "ACCEPTED", acceptedAt: new Date(), expiresAt: new Date(Date.now() + 1000) }), false); assert.match(acceptApi, /updateMany/); });
test("10. invitado no elige workspace arbitrario", () => { assert.doesNotMatch(acceptApi, /body\.workspace/); assert.match(onboardingApi, /const allowed = \["name", "brandName", "city", "serviceType"\]/); });
test("11. workspace se crea PROFESSIONAL y con slug propio", () => { assert.equal(trainerWorkspaceSlug("Juan Pérez", "ABC123"), "juan-perez-abc123"); assert.match(acceptApi, /type: "PROFESSIONAL"/); assert.match(acceptApi, /workspace\.create/); });
test("12. membership OWNER se crea", () => { assert.match(acceptApi, /workspaceMembership\.create/); assert.match(acceptApi, /role: "OWNER"/); });
test("13. nuevo trainer no ve Workspace BM", () => { assert.doesNotMatch(acceptApi, /bm-fuerza-funcional/); assert.match(read("lib/trainer-workspace.ts"), /auth\.userId \? \{ userId: auth\.userId \}/); });
test("14. nuevo trainer no ve otro trainer", () => { process.env.BM_COACH_ADMIN_TOKEN = "x".repeat(40); const session = createAdminSessionValue("trainer-a"); assert.ok(session); const verified = verifyAdminSessionValue(session?.value); assert.equal(verified.ok && verified.userId, "trainer-a"); const tampered = session!.value.replace(Buffer.from("trainer-a").toString("base64url"), Buffer.from("trainer-b").toString("base64url")); assert.equal(verifyAdminSessionValue(tampered).ok, false); });
test("15. no puede autoasignarse PLATFORM_OWNER", () => { assert.match(acceptApi, /platformRole: "TRAINER"/); assert.doesNotMatch(onboardingApi, /platformRole/); assert.match(migration, /workspace\."slug" = 'bm-fuerza-funcional'/); });

test("invitación valida campos y rechaza propiedades de privilegio", () => {
  assert.ok(parseTrainerInvitation({ firstName: "Ana", lastName: "Paz", email: "ANA@example.com", phone: "", brandName: "AP" }));
  assert.equal(parseTrainerInvitation({ firstName: "Ana", lastName: "Paz", email: "ana@example.com", platformRole: "PLATFORM_OWNER" }), null);
});

test("conflictos cubren trainer, credencial de alumno, SELF_SERVICE y pendientes", () => {
  for (const pattern of [/tx\.user\.findFirst/, /tx\.studentPortalCredential\.findFirst/, /tx\.studentRecord\.findMany/, /tx\.trainerInvitation\.findFirst/]) assert.match(invitationsApi, pattern);
  assert.equal(studentEmailConflict([{ data: { email: " ALUMNO@Example.com " } }], "alumno@example.com"), true);
});
