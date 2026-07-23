import { Prisma } from "@prisma/client";
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
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar las asignaciones." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/rutinas/[id]/asignaciones">) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { studentIds?: string[] };
    if (!Array.isArray(body.studentIds)) return Response.json({ error: "La lista de alumnos no es válida." }, { status: 400 });
    const studentIds = [...new Set(body.studentIds.map((studentId) => studentId.trim()).filter(Boolean))];
    const students = await prisma.studentRecord.count({ where: { id: { in: studentIds } } });
    if (students !== studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      const routine = await transaction.trainingRoutine.findUnique({ where: { id }, include: { assignments: true } });
      if (!routine) return null;
      if (routine.status === "ARCHIVADA") throw new Error("ROUTINE_ARCHIVED");
      const conflicts = await transaction.trainingRoutineAssignment.count({ where: { routineId: { not: id }, studentId: { in: studentIds }, active: true, routine: { status: "ACTIVA" } } });
      if (conflicts) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
      const selected = new Set(studentIds);
      for (const assignment of routine.assignments) {
        const active = selected.has(assignment.studentId);
        await transaction.trainingRoutineAssignment.update({ where: { routineId_studentId: { routineId: id, studentId: assignment.studentId } }, data: { active, archivedAt: active ? null : assignment.archivedAt ?? new Date() } });
      }
      const existingIds = new Set(routine.assignments.map((assignment) => assignment.studentId));
      const newIds = studentIds.filter((studentId) => !existingIds.has(studentId));
      if (newIds.length) await transaction.trainingRoutineAssignment.createMany({ data: newIds.map((studentId) => ({ routineId: id, studentId })) });
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!record) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    if (error instanceof Error && error.message === "ROUTINE_ARCHIVED") return Response.json({ error: "No se pueden modificar asignaciones de una rutina archivada." }, { status: 409 });
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Uno o más alumnos ya tienen otra rutina activa asignada." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Las asignaciones cambiaron al mismo tiempo. Recargá e intentá nuevamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al actualizar asignaciones", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al actualizar asignaciones", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron actualizar las asignaciones. No se borró el historial." }, { status: unavailable ? 503 : 500 });
  }
}
