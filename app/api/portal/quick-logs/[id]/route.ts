import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { QUICK_LOG_TYPES, quickLogJson } from "@/lib/quick-logs";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/portal/quick-logs/[id]">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const { id } = await context.params;
  const existing = await prisma.quickLog.findFirst({ where: { id, studentId: session.studentId } });
  if (!existing) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
  const input = await request.json() as Record<string, unknown>;
  const type = typeof input.type === "string" && QUICK_LOG_TYPES.includes(input.type as (typeof QUICK_LOG_TYPES)[number]) ? input.type as (typeof QUICK_LOG_TYPES)[number] : existing.type;
  const text = (key: string, fallback: string, max: number) => typeof input[key] === "string" ? input[key].trim().slice(0, max) : fallback;
  const number = (key: string, fallback: number | null) => input[key] === null || input[key] === "" ? null : input[key] === undefined ? fallback : Number(input[key]);
  const durationMinutes = number("durationMinutes", existing.durationMinutes);
  const previousValue = number("previousValue", existing.previousValue === null ? null : Number(existing.previousValue));
  const currentValue = number("currentValue", existing.currentValue === null ? null : Number(existing.currentValue));
  if ((durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) || [previousValue, currentValue].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) return Response.json({ error: "Revisá los valores numéricos." }, { status: 400 });
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T00:00:00Z`) : existing.date;
  const exerciseName = text("exerciseName", existing.exerciseName, 120);
  if (type === "PROGRESS" && (!exerciseName || currentValue === null)) return Response.json({ error: "Ejercicio y nuevo valor son obligatorios." }, { status: 400 });
  const updated = await prisma.quickLog.update({
    where: { id },
    data: {
      type, title: text("title", existing.title, 120), content: text("content", existing.content, 5000),
      category: text("category", existing.category, 60), date, durationMinutes, exerciseName,
      metricType: text("metricType", existing.metricType, 60), previousValue, currentValue,
      unit: text("unit", existing.unit, 30), mood: text("mood", existing.mood, 60),
      hasPain: typeof input.hasPain === "boolean" ? input.hasPain : existing.hasPain,
      painDetails: text("painDetails", existing.painDetails, 1000),
    },
    include: { photos: true },
  });
  return Response.json({ log: quickLogJson(updated), message: "Registro actualizado correctamente." });
}

export async function DELETE(request: Request, context: RouteContext<"/api/portal/quick-logs/[id]">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const { id } = await context.params;
  const input = await request.json().catch(() => ({})) as { photoId?: string };
  const existing = await prisma.quickLog.findFirst({ where: { id, studentId: session.studentId }, include: { photos: true } });
  if (!existing) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
  if (input.photoId) {
    const photo = existing.photos.find((item) => item.id === input.photoId);
    if (!photo) return Response.json({ error: "No se encontró la foto." }, { status: 404 });
    await prisma.quickLogPhoto.delete({ where: { id: photo.id } });
    await del(photo.blobUrl).catch((error) => console.error("No se pudo retirar la foto del Blob Store", error));
    return Response.json({ message: "Foto eliminada correctamente." });
  }
  await prisma.quickLog.delete({ where: { id } });
  await Promise.all(existing.photos.map((photo) => del(photo.blobUrl).catch((error) => console.error("No se pudo retirar una foto del registro", error))));
  return Response.json({ message: "Registro eliminado correctamente." });
}
