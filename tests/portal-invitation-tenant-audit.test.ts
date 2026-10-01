import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolvePortalStudentIdentity } from "../lib/portal-student-identity.ts";
import { parseStudentInvitationRegistration, STUDENT_INVITATION_DAYS } from "../lib/student-invitations.ts";

const source = (path: string) => readFileSync(path, "utf8");
const registration = {
  firstName: "Ana", lastName: "Paz", phone: "341 555 1234", birthDate: "2000-01-01",
  username: "Ana.Paz", password: "Password123", confirmPassword: "Password123",
};

test("A/B: la invitación fija workspace y servicio; username no puede elegirlos", () => {
  const create = source("app/api/alumnos/invitaciones/route.ts");
  const accept = source("app/api/student-invitations/[token]/route.ts");
  assert.match(create, /requireTrainerWorkspace\(/);
  assert.match(create, /workspaceId,/);
  assert.match(accept, /workspaceId: invitation!\.workspaceId/);
  assert.match(accept, /serviceType: invitationServiceType\(invitation!\.serviceType\)/);
  assert.match(accept, /studentPortalCredential\.findUnique\(\{ where: \{ username: input\.username \}/);
  assert.match(accept, /Ese usuario ya existe/);
  assert.equal(parseStudentInvitationRegistration({ ...registration, workspaceId: "workspace-b" }).input, null);
  assert.equal(parseStudentInvitationRegistration({ ...registration, serviceType: "MIXED" }).input, null);
  assert.equal(STUDENT_INVITATION_DAYS, 7);
  assert.match(accept, /status: "PENDING", usedAt: null, expiresAt:/);
  assert.match(accept, /if \(claimed\.count !== 1\) throw/);
});

test("A/B: login resuelve alumno y workspace por credencial y sesión, no por username", () => {
  const login = source("app/api/portal/login/route.ts");
  const auth = source("lib/portal-auth.ts");
  assert.match(login, /studentPortalCredential\.findUnique\(\{ where: \{ username \} \}\)/);
  assert.match(login, /createPortalSession\(credential\.studentId\)/);
  assert.match(auth, /resolvePortalStudentIdentity\(session\)/);
  const a = { studentId: "student-a", credential: { student: { id: "student-a", workspaceId: "workspace-a" } } };
  const b = { studentId: "student-b", credential: { student: { id: "student-b", workspaceId: "workspace-b" } } };
  assert.deepEqual(resolvePortalStudentIdentity(a), { studentId: "student-a", workspaceId: "workspace-a" });
  assert.deepEqual(resolvePortalStudentIdentity(b), { studentId: "student-b", workspaceId: "workspace-b" });
  assert.equal(resolvePortalStudentIdentity({ studentId: a.studentId, credential: b.credential }), null);
});

test("A/B: branding, rutina, evaluaciones y pagos se obtienen de identidad server-side", () => {
  const data = source("app/api/portal/data/route.ts");
  assert.match(data, /const session = await getPortalSession\(\)/);
  assert.match(data, /const studentId = session\.studentId/);
  assert.match(data, /activePortalRoutineWhere\(studentId, session\.credential\.student\.workspaceId/);
  assert.match(data, /physicalEvaluation\.findMany\(\{ where: \{ studentId,/);
  assert.match(data, /studentPayment\.findMany\(\{ where: \{ studentId,/);
  assert.match(source("app/api/portal/branding/route.ts"), /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
});

test("A/B: asistencia y horario relacionado también exigen workspace, incluso con vínculo cruzado", () => {
  const attendance = source("lib/portal-attendance-data.ts");
  const data = source("app/api/portal/data/route.ts");
  assert.match(attendance, /occurrence: \{ workspaceId, date: range/);
  assert.match(attendance, /OR: \[\{ scheduleId: null \}, \{ schedule: \{ workspaceId \} \}\]/);
  assert.match(attendance, /schedule: \{ workspaceId \}/);
  assert.match(attendance, /where: \{ id: studentId, workspaceId \}/);
  assert.match(data, /occurrence: \{ workspaceId, date:/);
  assert.match(data, /schedule: \{ workspaceId: session\.credential\.student\.workspaceId \}/);
  assert.match(data, /classWorkoutLog\.findFirst\(\{ where: \{ studentId, occurrence: \{ workspaceId \}/);
  assert.match(source("app/api/portal/asistencias/route.ts"), /loadPortalAttendance\(session\.studentId, session\.credential\.student\.workspaceId,/);
});

test("IDs cruzados: clase, rutina, evaluación, comentario y media se bloquean", () => {
  assert.match(source("app/api/portal/clases/route.ts"), /where: \{ id: occurrenceId, workspaceId \}/);
  assert.match(source("app/api/portal/entrenamientos/route.ts"), /assignment\?\.routine\.workspaceId !== session\.credential\.student\.workspaceId/);
  const comments = source("app/api/portal/comentarios/route.ts");
  assert.match(comments, /id: input\.evaluationId, studentId: session\.studentId/);
  assert.match(comments, /workspaceId: session\.credential\.student\.workspaceId/);
  assert.match(source("app/api/portal/media/[kind]/[id]/route.ts"), /student\.workspaceId !== actor\.workspaceId/);
});

test("cambio de sesión: datos privados no cacheados y borradores locales por alumno", () => {
  const data = source("app/api/portal/data/route.ts");
  const client = source("componentes/portal-section.tsx");
  assert.match(data, /"Cache-Control": "private, no-store"/);
  assert.match(client, /fetch\(`\$\{dataEndpoint\}\?section=\$\{dataSection\}`, \{ cache: "no-store", signal: controller\.signal \}\)/);
  assert.match(client, /setData\(null\)/);
  assert.match(client, /window\.location\.assign\("\/portal\/login"\)/);
  assert.match(source("lib/workout-week.ts"), /bm-workout:\$\{studentId\}:/);
  assert.match(source("lib/portal-events.ts"), /studentId/);
  assert.doesNotMatch(source("public/sw.js"), /addEventListener\("fetch"/);
});
