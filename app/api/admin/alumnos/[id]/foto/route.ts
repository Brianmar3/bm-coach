import { cookies } from "next/headers";
import { del } from "@vercel/blob";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import type { Student } from "@/types/gestion";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";

export async function DELETE(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/foto">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) { const failure = adminAuthError(auth); return Response.json({ error: failure.error }, { status: failure.status }); }
  const { id } = await context.params;
  const record = await prisma.studentRecord.findUnique({ where: { id }, select: { data: true } });
  if (!record) return Response.json({ error: "El alumno no existe." }, { status: 404 });
  const student = record.data as unknown as Student;
  await prisma.studentRecord.update({ where: { id }, data: { data: { ...student, profileImageUrl: "" } } });
  if (student.profileImageUrl?.includes(".blob.vercel-storage.com/")) await del(student.profileImageUrl).catch((error) => console.error("No se pudo retirar la foto del alumno", error));
  return Response.json({ message: "Foto eliminada correctamente." });
}
