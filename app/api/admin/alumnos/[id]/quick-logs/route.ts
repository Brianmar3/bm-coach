import { cookies } from "next/headers";
import { del } from "@vercel/blob";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { quickLogJson, quickLogRelations } from "@/lib/quick-logs";
import { loadQuickLogAchievements, recalculateQuickLogAchievements } from "@/lib/quick-log-achievements";

async function authorize() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  return auth.ok ? null : adminAuthError(auth);
}

export async function GET(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/quick-logs">) {
  const failure = await authorize(); if (failure) return Response.json({ error: failure.error }, { status: failure.status });
  const { id } = await context.params;
  await loadQuickLogAchievements(id);
  const logs = await prisma.quickLog.findMany({ where: { studentId: id }, include: quickLogRelations, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return Response.json({ logs: logs.map(quickLogJson) });
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/quick-logs">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const failure = await authorize(); if (failure) return Response.json({ error: failure.error }, { status: failure.status });
  const { id } = await context.params;
  const input = await request.json() as { logId?: string; title?: string; content?: string; category?: string; painDetails?: string };
  const existing = input.logId ? await prisma.quickLog.findFirst({ where: { id: input.logId, studentId: id } }) : null;
  if (!existing) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
  await prisma.quickLog.update({ where: { id: existing.id }, data: { title: input.title?.trim().slice(0, 120) ?? existing.title, content: input.content?.trim().slice(0, 5000) ?? existing.content, category: input.category?.trim().slice(0, 60) ?? existing.category, painDetails: input.painDetails?.trim().slice(0, 1000) ?? existing.painDetails } });
  return Response.json({ message: "Registro actualizado correctamente." });
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/quick-logs">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const failure = await authorize(); if (failure) return Response.json({ error: failure.error }, { status: failure.status });
  const { id } = await context.params;
  const input = await request.json() as { logId?: string };
  const existing = input.logId ? await prisma.quickLog.findFirst({ where: { id: input.logId, studentId: id }, include: { photos: true } }) : null;
  if (!existing) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
  await prisma.$transaction(async (transaction) => {
    await transaction.quickLog.delete({ where: { id: existing.id } });
    await recalculateQuickLogAchievements(transaction, id);
  });
  await Promise.all(existing.photos.map((photo) => del(photo.blobUrl).catch((error) => console.error("No se pudo retirar una foto del registro", error))));
  return Response.json({ message: "Registro eliminado correctamente." });
}
