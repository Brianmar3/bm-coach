import { databaseUnavailable, routineInclude, serializeRoutine } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]/asignaciones">) {
  try {
    const { id } = await context.params;
    const record = await prisma.trainingRoutine.findUnique({ where: { id }, include: routineInclude });
    if (!record) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(serializeRoutine(record).students);
  } catch (error) {
    console.error("Error al consultar asignaciones", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar las asignaciones desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/rutinas/[id]/asignaciones">) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { studentIds?: string[] };
    const studentIds = Array.isArray(body.studentIds) ? [...new Set(body.studentIds.map((studentId) => studentId.trim()).filter(Boolean))] : [];
    if (studentIds.length === 0) return Response.json({ error: "Asigná la rutina al menos a un alumno." }, { status: 400 });
    const students = await prisma.studentRecord.count({ where: { id: { in: studentIds } } });
    if (students !== studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      const routine = await transaction.trainingRoutine.findUnique({ where: { id }, select: { id: true } });
      if (!routine) return null;
      await transaction.trainingRoutineAssignment.deleteMany({ where: { routineId: id } });
      await transaction.trainingRoutineAssignment.createMany({ data: studentIds.map((studentId) => ({ routineId: id, studentId })) });
      return transaction.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() }, include: routineInclude });
    });
    if (!record) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    console.error("Error al actualizar asignaciones", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron actualizar las asignaciones en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
