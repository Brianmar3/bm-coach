import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
function name(data: Prisma.JsonValue) { const value = data as unknown as Student; return `${value.firstName ?? ""} ${value.lastName ?? ""}`.trim() || "Alumno"; }
export async function GET() {
  try {
    const [sessions, comments, students] = await Promise.all([
      prisma.workoutSession.findMany({ include: { student: true, routine: true, day: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
      prisma.followUpComment.findMany({ where: { parentId: null }, include: { student: true, replies: { orderBy: { createdAt: "asc" } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 30 }),
      prisma.studentRecord.findMany({ select: { id: true, data: true } }),
    ]);
    const trained = new Set(sessions.filter((item) => item.status === "COMPLETED").map((item) => item.studentId));
    return Response.json({
      sessions: sessions.map((item) => ({ id: item.id, studentName: name(item.student.data), routine: item.routine.name, dayNumber: item.day.dayNumber, date: item.date.toISOString().slice(0, 10), status: item.status.toLowerCase(), hasPain: item.hasPain, painDetails: item.painDetails })),
      comments: comments.map((item) => ({ id: item.id, studentName: name(item.student.data), body: item.body, category: item.category.toLowerCase(), status: item.status.toLowerCase(), context: item.context.toLowerCase(), replies: item.replies.map((reply) => ({ id: reply.id, body: reply.body, private: reply.private })) })),
      studentsWithoutTraining: students.filter((item) => (item.data as unknown as Student).status !== "inactivo" && !trained.has(item.id)).map((item) => ({ id: item.id, name: name(item.data) })).slice(0, 10),
    });
  } catch (error) { console.error("Error al cargar seguimiento", error); return Response.json({ error: "No se pudo cargar el seguimiento." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const input = await request.json() as { commentId?: string; body?: string; private?: boolean; status?: "PENDING" | "REVIEWED" };
    const comment = input.commentId ? await prisma.followUpComment.findUnique({ where: { id: input.commentId } }) : null;
    if (!comment || comment.parentId) return Response.json({ error: "Comentario no encontrado." }, { status: 404 });
    if (input.body?.trim()) await prisma.followUpComment.create({ data: { studentId: comment.studentId, author: "COACH", context: comment.context, category: comment.category, status: "REVIEWED", body: input.body.trim().slice(0, 2000), private: Boolean(input.private), sessionId: comment.sessionId, exerciseId: comment.exerciseId, evaluationId: comment.evaluationId, parentId: comment.id } });
    await prisma.followUpComment.update({ where: { id: comment.id }, data: { status: input.body?.trim() ? "REVIEWED" : input.status ?? comment.status } });
    return Response.json({ ok: true });
  } catch (error) { console.error("Error al actualizar seguimiento", error); return Response.json({ error: "No se pudo actualizar el seguimiento." }, { status: 500 }); }
}
