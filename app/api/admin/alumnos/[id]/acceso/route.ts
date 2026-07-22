import { prisma } from "@/lib/prisma";
import { adminAuthorization, hashPassword, normalizeUsername, temporaryPassword, validRequestOrigin } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  if (!validRequestOrigin(request)) return { ok: false as const, response: Response.json({ error: "Origen de solicitud inválido." }, { status: 403 }) };
  const authorization = adminAuthorization(request);
  return authorization.ok ? { ok: true as const } : { ok: false as const, response: Response.json({ error: authorization.error }, { status: authorization.status }) };
}

function accessResponse(credential: { username: string; active: boolean; mustChangePassword: boolean; createdAt: Date; updatedAt: Date }) {
  return { exists: true, username: credential.username, active: credential.active, mustChangePassword: credential.mustChangePassword, createdAt: credential.createdAt.toISOString(), updatedAt: credential.updatedAt.toISOString() };
}

async function uniqueUsername(student: Student, studentId: string) {
  const source = student.email?.trim() || student.phone?.replace(/\D/g, "") || `alumno-${studentId.slice(0, 8)}`;
  const base = normalizeUsername(source).slice(0, 80);
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await prisma.studentPortalCredential.findUnique({ where: { username: candidate }, select: { studentId: true } });
    if (!existing) return candidate;
    candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  throw new Error("No se pudo generar un usuario único.");
}

export async function GET(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/acceso">) {
  const authorization = authorize(request); if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const credential = await prisma.studentPortalCredential.findUnique({ where: { studentId: id } });
  return Response.json(credential ? accessResponse(credential) : { exists: false, active: false });
}

export async function POST(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/acceso">) {
  const authorization = authorize(request); if (!authorization.ok) return authorization.response;
  try {
    const { id } = await context.params;
    const existing = await prisma.studentPortalCredential.findUnique({ where: { studentId: id } });
    if (existing) return Response.json({ error: "El alumno ya tiene acceso. Usá Restablecer contraseña." }, { status: 409 });
    const record = await prisma.studentRecord.findUnique({ where: { id } });
    if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    const student = record.data as unknown as Student;
    const studentType = student.studentType ?? "Adulto";
    const phone = student.phone?.trim() ?? "";
    const hasPhone = Boolean(phone.replace(/\D/g, ""));
    if (studentType === "Kids" && !hasPhone) return Response.json({ error: "Los alumnos Kids sin teléfono no tienen acceso al portal." }, { status: 400 });
    const username = await uniqueUsername(student, id);
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const credential = await prisma.studentPortalCredential.create({ data: { studentId: id, username, passwordHash, active: true, mustChangePassword: true } });
    return Response.json({ ...accessResponse(credential), temporaryPassword: password }, { status: 201 });
  } catch (error) {
    console.error("Error al crear acceso del alumno", error);
    return Response.json({ error: "No se pudo crear el acceso del alumno." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/acceso">) {
  const authorization = authorize(request); if (!authorization.ok) return authorization.response;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { action?: "reset" | "activate" | "deactivate" };
    const existing = await prisma.studentPortalCredential.findUnique({ where: { studentId: id } });
    if (!existing) return Response.json({ error: "El alumno todavía no tiene acceso." }, { status: 404 });
    if (body.action === "reset") {
      const password = temporaryPassword();
      const passwordHash = await hashPassword(password);
      const credential = await prisma.$transaction(async (transaction) => {
        await transaction.studentPortalSession.deleteMany({ where: { studentId: id } });
        return transaction.studentPortalCredential.update({ where: { studentId: id }, data: { passwordHash, active: true, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null } });
      });
      return Response.json({ ...accessResponse(credential), temporaryPassword: password });
    }
    if (body.action === "deactivate") {
      const credential = await prisma.$transaction(async (transaction) => {
        await transaction.studentPortalSession.deleteMany({ where: { studentId: id } });
        return transaction.studentPortalCredential.update({ where: { studentId: id }, data: { active: false, failedLoginAttempts: 0, lockedUntil: null } });
      });
      return Response.json(accessResponse(credential));
    }
    if (body.action === "activate") {
      const credential = await prisma.studentPortalCredential.update({ where: { studentId: id }, data: { active: true, failedLoginAttempts: 0, lockedUntil: null } });
      return Response.json(accessResponse(credential));
    }
    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    console.error("Error al actualizar acceso del alumno", error);
    return Response.json({ error: "No se pudo actualizar el acceso del alumno." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/acceso">) {
  const authorization = authorize(request); if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  await prisma.studentPortalCredential.deleteMany({ where: { studentId: id } });
  return new Response(null, { status: 204 });
}
