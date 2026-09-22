import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdminSessionValue, verifyAdminSessionValue } from "../lib/admin-auth.ts";
import { invitationIsUsable, isPlatformOwner, trainerWorkspaceSlug } from "../lib/platform-access.ts";
import { parseTrainerInvitation, studentEmailConflict, trainerInvitationDisplayStatus, trainerInvitationToken, trainerInvitationTokenHash } from "../lib/trainer-invitations.ts";
import { parsePlatformSettings } from "../lib/platform-settings.ts";

const read = (path: string) => readFileSync(path, "utf8");
const platformLayout = read("app/platform/layout.tsx");
const platformPage = read("app/platform/page.tsx");
const platformLogin = read("app/api/platform/auth/login/route.ts");
const trainerLoginApi = read("app/api/admin/auth/login/route.ts");
const publicLogin = read("app/admin/login/page.tsx");
const sidebar = read("componentes/sidebar.tsx");
const platformShell = read("componentes/platform-shell.tsx");
const trainersApi = read("app/api/platform/trainers/route.ts");
const trainerStatusApi = read("app/api/platform/trainers/[id]/status/route.ts");
const sessionApi = read("app/api/admin/auth/session/route.ts");
const invitationsApi = read("app/api/platform/trainers/invitations/route.ts");
const acceptApi = read("app/api/trainer/invitations/[token]/accept/route.ts");
const onboardingApi = read("app/api/trainer/onboarding/route.ts");
const membershipsPage = read("app/platform/memberships/page.tsx");
const membershipsUi = read("componentes/platform-memberships.tsx");
const invitationsPage = read("app/platform/invitations/page.tsx");
const invitationsUi = read("componentes/platform-invitations.tsx");
const settingsPage = read("app/platform/settings/page.tsx");
const settingsApi = read("app/api/platform/settings/route.ts");
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

test("16. acceso master usa credenciales existentes y exige PLATFORM_OWNER activo", () => {
  assert.match(platformLogin, /verifyPassword/);
  assert.match(platformLogin, /user\.platformRole !== "PLATFORM_OWNER"/);
  assert.match(platformLogin, /user\.status !== "ACTIVE"/);
  assert.doesNotMatch(platformLogin, /verifyAdminCredential/);
  assert.doesNotMatch(trainerLoginApi, /platformRole/);
});

test("17. BM público y su sidebar no publican el acceso master", () => {
  assert.doesNotMatch(publicLogin, /credencial administrativa|cuenta maestra|PLATFORM_OWNER|plataforma/i);
  assert.doesNotMatch(sidebar, /\/platform|Plataforma|platformOwner/);
});

test("18. plataforma tiene navegación propia y conserva regreso a BM", () => {
  assert.match(platformLayout, /PlatformShell/);
  for (const label of ["Resumen", "Entrenadores", "Membresías", "Invitaciones", "Configuración", "Ir a BM Training"]) assert.match(platformShell, new RegExp(label));
});

test("19. resumen usa métricas comerciales reales", () => {
  assert.match(platformPage, /prisma\.user\.findMany/);
  assert.match(platformPage, /prisma\.trainerSubscription\.findMany/);
  assert.match(platformPage, /effectiveTrainerSubscriptionStatus/);
  assert.match(platformPage, /trainerInvitation\.count/);
});

test("20. suspensión conserva datos y sólo cambia el estado de un TRAINER profesional", () => {
  assert.match(trainerStatusApi, /platformOwnerApiAccess/);
  assert.match(trainerStatusApi, /platformRole: "TRAINER"/);
  assert.match(trainerStatusApi, /type: "PROFESSIONAL"/);
  assert.match(trainerStatusApi, /body\?\.status !== "ACTIVE".*body\?\.status !== "SUSPENDED"/s);
  assert.match(trainerStatusApi, /tx\.user\.update/);
  assert.match(trainerStatusApi, /tx\.trainerSubscription\.updateMany/);
  assert.doesNotMatch(trainerStatusApi, /delete/);
  assert.match(sessionApi, /user\.status !== "ACTIVE"/);
});

test("21. listado master se limita a trainers profesionales y no mezcla workspaces", () => {
  assert.match(trainersApi, /platformRole: "TRAINER"/);
  assert.match(trainersApi, /workspace: \{ type: "PROFESSIONAL" \}/);
  assert.match(trainersApi, /where: \{ role: "OWNER", workspace: \{ type: "PROFESSIONAL" \} \}/);
});

test("invitación valida campos y rechaza propiedades de privilegio", () => {
  assert.ok(parseTrainerInvitation({ firstName: "Ana", lastName: "Paz", email: "ANA@example.com", phone: "", brandName: "AP" }));
  assert.equal(parseTrainerInvitation({ firstName: "Ana", lastName: "Paz", email: "ana@example.com", platformRole: "PLATFORM_OWNER" }), null);
});

test("conflictos cubren trainer, credencial de alumno, SELF_SERVICE y pendientes", () => {
  for (const pattern of [/tx\.user\.findFirst/, /tx\.studentPortalCredential\.findFirst/, /tx\.studentRecord\.findMany/, /tx\.trainerInvitation\.findFirst/]) assert.match(invitationsApi, pattern);
  assert.equal(studentEmailConflict([{ data: { email: " ALUMNO@Example.com " } }], "alumno@example.com"), true);
});

test("navegación master habilita todas las secciones en una sola franja móvil", () => {
  for (const href of ["/platform/trainers", "/platform/memberships", "/platform/invitations", "/platform/settings"]) assert.match(platformShell, new RegExp(href));
  assert.doesNotMatch(platformShell, /aria-disabled/);
  assert.match(platformShell, /overflow-x-auto/);
  assert.match(platformShell, /Opciones de cuenta/);
});

test("membresías ofrece filtros y acciones comerciales protegidas por las APIs existentes", () => {
  assert.match(membershipsPage, /requirePlatformOwnerPage/);
  for (const label of ["Todas", "Al día", "Vencidas", "Suspendidas", "Canceladas", "Próximas a vencer", "Marcar pagado", "Suspender", "Reactivar"]) assert.match(membershipsUi, new RegExp(label));
  assert.match(membershipsUi, /\/mark-paid/);
  assert.match(membershipsUi, /SUSPEND_ACCESS/);
  assert.match(membershipsUi, /REACTIVATE_ACCESS/);
});

test("invitaciones distingue estados y regenera el mismo registro sin crear otro trainer", () => {
  assert.match(invitationsPage, /requirePlatformOwnerPage/);
  for (const label of ["Pendiente", "Usada", "Vencida", "Cancelada", "Copiar link", "Generar nuevo link"]) assert.match(invitationsUi, new RegExp(label));
  assert.equal(trainerInvitationDisplayStatus({ status: "PENDING", acceptedAt: null, expiresAt: new Date(Date.now() - 1) }), "EXPIRED");
  assert.equal(trainerInvitationDisplayStatus({ status: "ACCEPTED", acceptedAt: new Date(), expiresAt: new Date() }), "USED");
  assert.match(invitationsApi, /trainerInvitation\.update/);
  assert.match(invitationsApi, /tokenHash: trainerInvitationTokenHash/);
});

test("configuración master valida catálogo y permanece separada del branding de workspaces", () => {
  assert.match(settingsPage, /requirePlatformOwnerPage/);
  assert.match(settingsApi, /platformOwnerApiAccess/);
  assert.match(settingsApi, /validRequestOrigin/);
  assert.doesNotMatch(settingsApi, /CoachSettings|accentColor|logoMode/);
  assert.ok(parsePlatformSettings({ platformName: "BM Training", supportEmail: "soporte@bm.test", invitationDays: 7, defaultTrainerPlan: "STARTER", initialPeriodMonths: 1 }));
  assert.equal(parsePlatformSettings({ platformName: "BM", supportEmail: "", invitationDays: 999, defaultTrainerPlan: "STARTER", initialPeriodMonths: 1 }), null);
});

test("aceptación aplica plan y período inicial configurados sin permitirlos desde el frontend", () => {
  assert.match(acceptApi, /loadPlatformSettings/);
  assert.match(acceptApi, /trainerSubscription\.create/);
  assert.match(acceptApi, /settings\.defaultTrainerPlan/);
  assert.match(acceptApi, /settings\.initialPeriodMonths/);
  assert.doesNotMatch(acceptApi, /body\.defaultTrainerPlan|body\.initialPeriodMonths/);
});
