import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseWeeklyClassInput, serializeWeeklyClass, studentsExist, weeklyClassInclude } from "@/lib/weekly-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class UnknownStudentError extends Error {}

function databaseError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(_request: Request, context: RouteContext<"/api/clases/[id]">) {
  try {
    const { id } = await context.params;
    const schedule = await prisma.weeklyClassSchedule.findUnique({ where: { id }, include: weeklyClassInclude });
    if (!schedule) return Response.json({ error: "Horario semanal no encontrado." }, { status: 404 });
    return Response.json(serializeWeeklyClass(schedule));
  } catch (error) {
    console.error("Error al consultar horario semanal", error);
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudo cargar el horario semanal." }, { status: databaseError(error) ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/clases/[id]">) {
  try {
    const { id } = await context.params;
    const parsed = parseWeeklyClassInput(await request.json());
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const { studentIds, ...scheduleData } = parsed.data;
    const schedule = await prisma.$transaction(async (transaction) => {
      if (!await studentsExist(transaction, studentIds)) throw new UnknownStudentError();
      return transaction.weeklyClassSchedule.update({
        where: { id },
        data: {
          ...scheduleData,
          assignments: {
            deleteMany: {},
            create: studentIds.map((studentId) => ({ studentId })),
          },
        },
        include: weeklyClassInclude,
      });
    });
    return Response.json(serializeWeeklyClass(schedule));
  } catch (error) {
    console.error("Error al actualizar horario semanal", error);
    if (error instanceof SyntaxError) return Response.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
    if (error instanceof UnknownStudentError) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 400 });
    if (notFound(error)) return Response.json({ error: "Horario semanal no encontrado." }, { status: 404 });
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudo actualizar el horario semanal." }, { status: databaseError(error) ? 503 : 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/clases/[id]">) {
  try {
    const { id } = await context.params;
    const schedule = await prisma.weeklyClassSchedule.findUnique({
      where: { id },
      select: { id: true, _count: { select: { occurrences: true, attendances: true } } },
    });
    if (!schedule) return Response.json({ error: "Horario semanal no encontrado." }, { status: 404 });
    if (schedule._count.occurrences > 0 || schedule._count.attendances > 0) {
      await prisma.weeklyClassSchedule.update({ where: { id }, data: { active: false } });
      return Response.json({ action: "archived", message: "El horario fue desactivado porque tiene historial asociado." });
    }
    await prisma.weeklyClassSchedule.delete({ where: { id } });
    return Response.json({ action: "deleted", message: "Horario eliminado definitivamente." });
  } catch (error) {
    console.error("Error al eliminar horario semanal", error);
    if (notFound(error)) return Response.json({ error: "Horario semanal no encontrado." }, { status: 404 });
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudo eliminar el horario semanal." }, { status: databaseError(error) ? 503 : 500 });
  }
}
