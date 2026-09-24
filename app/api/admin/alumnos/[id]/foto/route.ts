import { assertStudentInWorkspace, requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { cookies } from "next/headers";
import { removeStudentPhoto } from "@/lib/student-media-storage";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import type { Student } from "@/types/gestion";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";

export async function DELETE(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/foto">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) { const failure = adminAuthError(auth); return Response.json({ error: failure.error }, { status: failure.status }); }
  const { id } = await context.params;
  await assertStudentInWorkspace(id, (await requireTrainerWorkspace()).workspaceId);
  const record = await prisma.studentRecord.findUnique({ where: { id }, select: { data: true, updatedAt: true } });
  if (!record) return Response.json({ error: "El alumno no existe." }, { status: 404 });
  const student = record.data as unknown as Student;
  const saved = await prisma.studentRecord.updateMany({ where: { id, updatedAt: record.updatedAt }, data: { data: { ...student, profileImageUrl: "" } } });
  if (saved.count !== 1) return Response.json({ error: "El perfil cambió. Actualizá antes de reintentar." }, { status: 409 });
  await removeStudentPhoto(student.profileImageUrl ?? "", id, "profile");
  return Response.json({ message: "Foto eliminada correctamente." });
}
