import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { findWorkspacePhoneDuplicate } from "../lib/student-phone-identity.ts";
import { resolvePortalStudentIdentity } from "../lib/portal-student-identity.ts";
import { persistUploadedWorkspaceLogo, WorkspaceLogoPersistenceError } from "../lib/workspace-logo-persistence.ts";
import { validateWorkspaceLogoBytes, workspaceLogoMetadataError } from "../lib/workspace-logo-upload.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("el mismo teléfono se permite entre workspaces y se rechaza dentro del mismo", () => {
  const records = [
    { id: "student-a", workspaceId: "workspace-a", phoneNormalized: "3415551111", data: { phone: "+54 341 555-1111" } },
  ];
  assert.equal(findWorkspacePhoneDuplicate(records, "workspace-b", "3415551111"), null);
  assert.equal(findWorkspacePhoneDuplicate(records, "workspace-a", "3415551111")?.id, "student-a");
  assert.equal(findWorkspacePhoneDuplicate(records, "workspace-a", "3415551111", "student-a"), null);
});

test("schema y migración reemplazan la unique global por workspace + teléfono", () => {
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model StudentRecord"), schema.indexOf("enum MembershipHistoryStatus"));
  const migration = read("prisma/migrations/20260922220000_workspace_student_phone_scope/migration.sql");
  assert.doesNotMatch(model, /phoneNormalized\s+String\?\s+@unique/);
  assert.match(model, /@@unique\(\[workspaceId, phoneNormalized\]\)/);
  assert.match(migration, /DROP INDEX IF EXISTS "students_phoneNormalized_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "students_workspaceId_phoneNormalized_key"/);
  assert.match(migration, /\("workspaceId", "phoneNormalized"\)/);
});

test("create, update y perfil deduplican dentro del workspace activo", () => {
  const enrollment = read("lib/student-enrollment.ts");
  const create = read("app/api/alumnos/route.ts");
  const update = read("app/api/alumnos/[id]/route.ts");
  const profile = read("app/api/portal/profile/route.ts");
  assert.match(enrollment, /where: \{ workspaceId,/);
  assert.match(create, /duplicatePhone\(transaction, workspaceId, normalizedPhone\)/);
  assert.match(update, /duplicatePhone\(transaction, workspaceId, normalizedPhone, id\)/);
  assert.match(profile, /duplicatePhone\(transaction, record\.workspaceId, normalizedPhone, session\.studentId\)/);
});

test("login y sesiones resuelven StudentRecord y workspace sin usar el teléfono", () => {
  const login = read("app/api/portal/login/route.ts");
  const auth = read("lib/portal-auth.ts");
  assert.match(login, /studentPortalCredential\.findUnique\(\{ where: \{ username \} \}\)/);
  assert.doesNotMatch(login, /phoneNormalized|normalizePhone/);
  assert.match(auth, /resolvePortalStudentIdentity\(session\)/);
  assert.match(read("prisma/schema.prisma"), /username\s+String\s+@unique/);
  assert.match(read("prisma/schema.prisma"), /tokenHash\s+String\s+@unique/);

  const sessionA = { studentId: "student-a", credential: { student: { id: "student-a", workspaceId: "workspace-a" } } };
  const sessionB = { studentId: "student-b", credential: { student: { id: "student-b", workspaceId: "workspace-b" } } };
  assert.deepEqual(resolvePortalStudentIdentity(sessionA), { studentId: "student-a", workspaceId: "workspace-a" });
  assert.deepEqual(resolvePortalStudentIdentity(sessionB), { studentId: "student-b", workspaceId: "workspace-b" });
  assert.equal(resolvePortalStudentIdentity({ studentId: "student-a", credential: { student: { id: "student-b", workspaceId: "workspace-b" } } }), null);
});

test("datos, clases y branding del portal quedan anclados a la sesión A/B", () => {
  const data = read("app/api/portal/data/route.ts");
  const classes = read("app/api/portal/clases/route.ts");
  const branding = read("app/api/portal/branding/route.ts");
  assert.match(data, /const studentId = session\.studentId/);
  assert.match(data, /session\.credential\.student\.workspaceId/);
  assert.match(data, /studentPayment\.findMany\(\{ where: \{ studentId,/);
  assert.match(data, /monthlyStudentObligation\.findMany\(\{ where: \{ studentId \}/);
  assert.match(classes, /studentId: session\.studentId/);
  assert.match(classes, /const workspaceId = session\.credential\.student\.workspaceId/);
  assert.match(branding, /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
});

test("SELF_SERVICE conserva username global pero no bloquea teléfonos de otro workspace", () => {
  const registration = read("app/api/portal/registro/route.ts");
  assert.match(registration, /studentPortalCredential\.findUnique\(\{ where: \{ username: input\.email \}/);
  assert.doesNotMatch(registration, /record\.phoneNormalized === phoneNormalized/);
  assert.doesNotMatch(registration, /data\.phone\.replace\(\/\\D\/g, ""\) === phoneNormalized/);
  assert.doesNotMatch(read("app/api/platform/trainers/invitations/route.ts"), /phoneNormalized|normalizePhone/);
  assert.doesNotMatch(read("app/api/trainer/invitations/[token]/accept/route.ts"), /phoneNormalized|normalizePhone/);
});

test("PNG, JPG/JPEG y WEBP móviles validan firma real y límite", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(validateWorkspaceLogoBytes(jpeg, "image/jpg")?.mime, "image/jpeg");
  assert.equal(validateWorkspaceLogoBytes(png, "image/png")?.mime, "image/png");
  assert.equal(validateWorkspaceLogoBytes(webp, "application/octet-stream")?.mime, "image/webp");
  assert.equal(workspaceLogoMetadataError({ size: 3 * 1024 * 1024 + 1, type: "image/png" }), "El logo supera el máximo de 3 MB.");
});

test("upload exitoso persiste URL y CUSTOM sólo después de completar Blob", async () => {
  const persisted: Array<Record<string, unknown>> = [];
  const removed: string[] = [];
  const result = await persistUploadedWorkspaceLogo({
    current: { logoMode: "DEFAULT", customLogoUrl: "https://store.private.blob.vercel-storage.com/old.png" },
    previousUrl: "https://store.private.blob.vercel-storage.com/old.png",
    upload: async () => ({ url: "https://store.private.blob.vercel-storage.com/new.png" }),
    persist: async (next) => { persisted.push(next); },
    remove: async (url) => { removed.push(url); },
  });
  assert.equal(result.next.logoMode, "CUSTOM");
  assert.equal(result.next.customLogoUrl, "https://store.private.blob.vercel-storage.com/new.png");
  assert.equal(persisted[0].logoMode, "CUSTOM");
  assert.deepEqual(removed, ["https://store.private.blob.vercel-storage.com/old.png"]);
});

test("fallo Blob conserva logo anterior y no intenta persistir CUSTOM", async () => {
  let persisted = false;
  const removed: string[] = [];
  await assert.rejects(() => persistUploadedWorkspaceLogo({
    current: { logoMode: "CUSTOM", customLogoUrl: "https://store.private.blob.vercel-storage.com/old.png" },
    previousUrl: "https://store.private.blob.vercel-storage.com/old.png",
    upload: async () => { throw new Error("private store mismatch"); },
    persist: async () => { persisted = true; },
    remove: async (url) => { removed.push(url); },
  }), (error) => error instanceof WorkspaceLogoPersistenceError && error.code === "STORAGE_UPLOAD_FAILED");
  assert.equal(persisted, false);
  assert.deepEqual(removed, []);
});

test("fallo de persistencia elimina sólo el blob nuevo y conserva el anterior", async () => {
  const removed: string[] = [];
  await assert.rejects(() => persistUploadedWorkspaceLogo({
    current: { logoMode: "DEFAULT", customLogoUrl: "https://store.private.blob.vercel-storage.com/old.png" },
    previousUrl: "https://store.private.blob.vercel-storage.com/old.png",
    upload: async () => ({ url: "https://store.private.blob.vercel-storage.com/new.png" }),
    persist: async () => { throw new Error("database unavailable"); },
    remove: async (url) => { removed.push(url); },
  }), (error) => error instanceof WorkspaceLogoPersistenceError && error.code === "SETTINGS_PERSISTENCE_FAILED");
  assert.deepEqual(removed, ["https://store.private.blob.vercel-storage.com/new.png"]);
});

test("store privado se sirve por proxy autenticado y conserva fallback BM", () => {
  const upload = read("app/api/workspace/logo/route.ts");
  const image = read("app/api/workspace/logo/image/route.ts");
  const component = read("componentes/workspace-brand-logo.tsx");
  assert.match(upload, /access: "private"/);
  assert.match(upload, /LOGO_STORAGE_UPLOAD_FAILED/);
  assert.match(upload, /LOGO_PERSISTENCE_FAILED/);
  assert.match(image, /get\(source, \{ access: "private" \}\)/);
  assert.match(image, /loadWorkspaceBranding\(portalSession\.credential\.student\.workspaceId\)/);
  assert.match(image, /branding\.customLogoUrl === source/);
  assert.match(component, /\/api\/workspace\/logo\/image\?source=/);
  assert.match(component, /onError=\{\(\) => setFailedCustomUrl\(branding\.customLogoUrl\)\}/);
  assert.match(component, /src="\/bm-training-mark\.png"/);
});
