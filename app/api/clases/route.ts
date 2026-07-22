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

export async function GET() {
  try {
    const schedules = await prisma.weeklyClassSchedule.findMany({
      include: weeklyClassInclude,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { classType: "asc" }],
    });
    return Response.json(schedules.map(serializeWeeklyClass));
  } catch (error) {
    console.error("Error al consultar horarios semanales", error);
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudieron cargar los horarios semanales." }, { status: databaseError(error) ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = parseWeeklyClassInput(await request.json());
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const { studentIds, ...scheduleData } = parsed.data;
    const schedule = await prisma.$transaction(async (transaction) => {
      if (!await studentsExist(transaction, studentIds)) throw new UnknownStudentError();
      return transaction.weeklyClassSchedule.create({
        data: {
          ...scheduleData,
          assignments: { create: studentIds.map((studentId) => ({ studentId })) },
        },
        include: weeklyClassInclude,
      });
    });
    return Response.json(serializeWeeklyClass(schedule), { status: 201 });
  } catch (error) {
    console.error("Error al crear horario semanal", error);
    if (error instanceof SyntaxError) return Response.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
    if (error instanceof UnknownStudentError) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 400 });
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudo crear el horario semanal." }, { status: databaseError(error) ? 503 : 500 });
  }
}
