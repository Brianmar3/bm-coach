import { prisma } from "@/lib/prisma";
import { getPortalSession, hashPassword, passwordValidationError, validRequestOrigin, verifyPassword } from "@/lib/portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const validationError = passwordValidationError(newPassword);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  if (!(await verifyPassword(currentPassword, session.credential.passwordHash))) return Response.json({ error: "La contraseña actual es incorrecta." }, { status: 400 });
  if (await verifyPassword(newPassword, session.credential.passwordHash)) return Response.json({ error: "La nueva contraseña debe ser diferente." }, { status: 400 });
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.studentPortalCredential.update({ where: { studentId: session.studentId }, data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null } }),
    prisma.studentPortalSession.deleteMany({ where: { studentId: session.studentId, id: { not: session.id } } }),
  ]);
  return Response.json({ ok: true });
}
