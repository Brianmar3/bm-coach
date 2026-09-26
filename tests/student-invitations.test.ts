import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decryptStudentInvitationToken, encryptStudentInvitationToken, invitationServiceType, parseStudentInvitationRegistration, STUDENT_INVITATION_DAYS, studentInvitationDisplayStatus, studentInvitationToken, studentInvitationTokenHash, studentInvitationWhatsappText, validStudentInvitationToken } from "../lib/student-invitations.ts";
import { findWorkspacePhoneDuplicate } from "../lib/student-phone-identity.ts";
import { trainerStudentCapacity } from "../lib/trainer-plan-limits.ts";
import { resolveWorkspaceBranding } from "../lib/workspace-branding.ts";

const read = (path: string) => readFileSync(path, "utf8");
const consume = read("app/api/student-invitations/[token]/route.ts");
const manage = read("app/api/alumnos/invitaciones/route.ts");
const access = read("lib/student-invitations-server.ts");
const publicPage = read("app/join/student/[token]/page.tsx");
const publicForm = read("componentes/student-invitation-form.tsx");
const manual = read("app/api/alumnos/route.ts");
const proxy = read("proxy.ts");
const validInput = { firstName: "Ana", lastName: "Paz", phone: "341 555 1234", birthDate: "2000-01-01", username: "AnA.Paz", password: "Password123", confirmPassword: "Password123" };

test("token aleatorio y hash irreversible, cifrado sólo para copiar enlace", () => {
  process.env.BM_COACH_ADMIN_TOKEN = "x".repeat(40);
  const first = studentInvitationToken(); const second = studentInvitationToken();
  assert.ok(validStudentInvitationToken(first)); assert.notEqual(first, second);
  assert.notEqual(studentInvitationTokenHash(first), first);
  assert.equal(decryptStudentInvitationToken(encryptStudentInvitationToken(first)), first);
});
test("enlace pendiente dura siete días; usado, vencido y revocado se rechazan", () => {
  assert.equal(STUDENT_INVITATION_DAYS, 7);
  const future = new Date(Date.now() + 1000); const past = new Date(Date.now() - 1000);
  assert.equal(studentInvitationDisplayStatus({ status: "PENDING", expiresAt: future }), "PENDING");
  assert.equal(studentInvitationDisplayStatus({ status: "USED", expiresAt: future }), "USED");
  assert.equal(studentInvitationDisplayStatus({ status: "PENDING", expiresAt: past }), "EXPIRED");
  assert.equal(studentInvitationDisplayStatus({ status: "REVOKED", expiresAt: future }), "REVOKED");
});
test("registro valida username, teléfono y confirmación", () => {
  assert.equal(parseStudentInvitationRegistration(validInput).input?.username, "ana.paz");
  assert.match(parseStudentInvitationRegistration({ ...validInput, confirmPassword: "otro" }).error, /contraseñas/);
  assert.equal(parseStudentInvitationRegistration({ ...validInput, phone: "123" }).input, null);
  assert.equal(parseStudentInvitationRegistration({ ...validInput, username: "a" }).input, null);
});
test("el trainer elige Clases, Personalizado o Mixto antes de generar el enlace", () => {
  const chooser = read("componentes/student-invitations.tsx");
  assert.match(chooser, /STUDENT_SERVICE_OPTIONS\.map/);
  assert.match(chooser, /body: JSON\.stringify\(\{ serviceType \}\)/);
  assert.match(manage, /isStudentServiceType\(serviceType\)/);
  assert.match(manage, /studentInvitation\.create\(\{ data: \{[^}]*serviceType/);
  for (const serviceType of ["CLASSES", "PERSONALIZED", "MIXED"] as const) {
    assert.equal(invitationServiceType(serviceType), serviceType);
  }
});
test("el alta usa el servicio guardado en el token y el alumno no puede cambiarlo", () => {
  assert.match(consume, /serviceType: invitationServiceType\(invitation!\.serviceType\)/);
  assert.match(consume, /serviceType: studentInput\.serviceType/);
  assert.equal(parseStudentInvitationRegistration({ ...validInput, serviceType: "MIXED" }).input, null);
  assert.doesNotMatch(read("componentes/student-invitation-form.tsx"), /name="serviceType"/);
  assert.match(read("componentes/student-invitation-form.tsx"), /Nombre de usuario<input name="username"/);
  assert.equal(invitationServiceType(null), "PERSONALIZED"); // Sólo enlaces anteriores a esta migración.
  assert.match(read("prisma/migrations/20260924180000_student_invitation_service_type/migration.sql"), /ADD COLUMN "serviceType" "StudentServiceType";/);
});
test("teléfono duplicado sólo dentro del workspace", () => {
  const records = [{ id: "a", workspaceId: "A", phoneNormalized: "3415551234", data: {} }];
  assert.equal(findWorkspacePhoneDuplicate(records, "A", "3415551234")?.id, "a");
  assert.equal(findWorkspacePhoneDuplicate(records, "B", "3415551234"), null);
});
test("capacidad FREE, STARTER, PRO, PREMIUM y trial", () => {
  for (const [plan, limit] of [["FREE", 5], ["STARTER", 20], ["PRO", 50], ["PREMIUM", null]] as const) {
    assert.equal(trainerStudentCapacity(plan, 0).limit, limit);
    if (limit) assert.equal(trainerStudentCapacity(plan, limit).reached, true);
  }
  assert.match(read("lib/trainer-plan-limits-server.ts"), /effectiveTrainerPlan/);
});
test("alta atómica reclama token, comprueba acceso, cupo, usuario y teléfono", () => {
  for (const pattern of [/TransactionIsolationLevel\.Serializable/, /pg_advisory_xact_lock/, /studentInvitation\.updateMany/, /assertTrainerCanAddStudent/, /studentPortalCredential\.findUnique/, /duplicatePhone/, /studentRecord\.create/, /recordInitialStudentHistory/]) assert.match(consume, pattern);
  assert.match(consume, /status: "PENDING", usedAt: null, expiresAt:/);
});
test("rollback conserva invitación si falla alta y uso simultáneo sólo reclama una vez", () => {
  assert.match(consume, /tx\.studentInvitation\.updateMany/);
  assert.match(consume, /if \(claimed\.count !== 1\) throw/);
  assert.match(consume, /tx\.studentRecord\.create/);
  assert.match(consume, /P2034/);
});
test("workspace profesional viene del token y no del navegador", () => {
  assert.match(consume, /invitation!\.workspaceId/);
  assert.doesNotMatch(consume, /body\.workspaceId|input\.workspaceId/);
  assert.match(access, /type !== "PROFESSIONAL"/);
  assert.match(access, /workspace: \{ type: "PROFESSIONAL", status: "ACTIVE" \}/);
});
test("trainer suspendido y workspace inaccesible bloquean consumo", () => {
  assert.match(access, /invitation\.inviter\.status !== "ACTIVE"/);
  assert.match(access, /user: \{ status: "ACTIVE" \}/);
  assert.match(consume, /studentInvitationWorkspaceAccess/);
});
test("SELF_SERVICE permanece fuera del flujo profesional", () => {
  assert.match(access, /type: "PROFESSIONAL"/);
  assert.doesNotMatch(consume, /personalWorkspaceData|workspace\.create/);
  assert.match(read("lib/trainer-plan-limits.ts"), /accountType === "SELF_SERVICE"/);
});
test("branding de la invitación se resuelve tras validar token", () => {
  assert.ok(publicPage.indexOf("invitationUnavailableMessage") < publicPage.indexOf("loadWorkspaceBranding"));
  assert.match(read("app/api/student-invitations/[token]/logo/route.ts"), /activeStudentInvitation/);
  assert.equal(resolveWorkspaceBranding({ systemName: "Mi Gym" }, "PREMIUM").displayName, "Mi Gym");
  assert.equal(resolveWorkspaceBranding({ systemName: "Mi Gym" }, "STARTER").displayName, "BM Training");
});
test("gestión sólo del workspace trainer, copiar, revocar y WhatsApp", () => {
  assert.match(manage, /requireTrainerWorkspace/);
  assert.match(manage, /where: \{ workspaceId \}/);
  assert.match(manage, /status: "REVOKED"/);
  assert.match(studentInvitationWhatsappText("https://example.com"), /https:\/\/example\.com/);
  assert.match(read("componentes/student-invitations.tsx"), /wa\.me/);
});
test("carga manual existente no cambia", () => {
  assert.match(manual, /parseStudentInput/);
  assert.match(manual, /assertTrainerCanAddStudent/);
  assert.match(manual, /duplicatePhone/);
  assert.match(read("app/alumnos/page.tsx"), /Cargar manualmente/);
});
test("rutas públicas no dependen de sesión activa", () => {
  assert.match(proxy, /studentInvitationRoute/);
  assert.match(proxy, /\/join\/student\//);
  assert.match(proxy, /\/api\/student-invitations\//);
  assert.match(read("componentes/app-frame.tsx"), /pathname\.startsWith\("\/join\/student\/"\)/);
});
test("la invitación usa acceso explícito de alumno sin heredar la sesión trainer", () => {
  const loginPage = read("app/portal/login/page.tsx");
  assert.match(publicForm, /href="\/portal\/login\?mode=student"/);
  assert.match(publicForm, /Ingresar como alumno/);
  assert.match(consume, /loginUrl: "\/portal\/login\?mode=student"/);
  assert.match(loginPage, /explicitStudentLogin/);
  assert.ok(loginPage.indexOf("if (explicitStudentLogin)") < loginPage.indexOf("const experience = choosePortalExperience"));
  assert.doesNotMatch(loginPage.slice(loginPage.indexOf("if (explicitStudentLogin)"), loginPage.indexOf("const experience = choosePortalExperience")), /redirect\("\/dashboard"\)/);
});
test("la invitación aplica branding del workspace en un contenedor público móvil", () => {
  assert.match(publicForm, /workspace-brand min-h-\[100dvh\] overflow-x-hidden/);
  assert.match(publicForm, /Powered by BM Training/);
  assert.match(publicForm, /workspaceBrandingVariables\(branding\.accentColor\)/);
});
test("username global duplicado se rechaza antes de crear el alumno", () => {
  assert.match(consume, /studentPortalCredential\.findUnique\(\{ where: \{ username: input\.username \}/);
  assert.match(consume, /Ese usuario ya existe/);
});
test("contraseña del alumno usa hashing y política existentes", () => {
  assert.match(consume, /passwordValidationError\(input\.password\)/);
  assert.match(consume, /hashPassword\(input\.password\)/);
  assert.match(consume, /mustChangePassword: false/);
  assert.doesNotMatch(manage, /passwordHash|temporaryPassword/);
});
test("el enlace no permite elegir workspace ni crear uno PERSONAL", () => {
  assert.doesNotMatch(publicPage, /searchParams.*workspaceId/);
  assert.doesNotMatch(consume, /workspace\.create|workspaceId: input/);
  assert.match(consume, /workspaceId: invitation!\.workspaceId/);
});
test("invitación revocada o usada no vuelve a estado pendiente", () => {
  assert.match(manage, /status: "PENDING", expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(consume, /status: "PENDING", usedAt: null/);
  assert.doesNotMatch(manage, /status: "USED"/);
});
test("el logo privado sólo se expone a través de token válido del mismo workspace", () => {
  const logo = read("app/api/student-invitations/[token]/logo/route.ts");
  assert.match(logo, /studentInvitationWorkspaceAccess\(invitation\.workspaceId, invitation\.inviterId\)/);
  assert.match(logo, /loadWorkspaceBranding\(invitation\.workspaceId\)/);
  assert.doesNotMatch(logo, /searchParams|get\(source/);
});
test("invitaciones de alumnos no entran al Master", () => {
  assert.doesNotMatch(read("app/platform/page.tsx"), /studentInvitation/);
  assert.doesNotMatch(read("componentes/platform-trainers.tsx"), /studentInvitation/);
});
