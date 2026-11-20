import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseWeeklyClassInput, serializeWeeklyClass, studentsExist, weeklyClassInclude, WEEKDAYS } from "@/lib/weekly-classes";
import type { WeeklyClassDay } from "@/types/gestion";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class UnknownStudentError extends Error {}
class DuplicateScheduleError extends Error {}

function databaseError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const schedules = await prisma.weeklyClassSchedule.findMany({
      where: { workspaceId, archivedAt: null },
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
    const { workspaceId } = await requireTrainerWorkspace();
    const body = await request.json() as Record<string, unknown>;
    const parsed = parseWeeklyClassInput(body);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const multiple = body.dayOfWeeks !== undefined;
    if (multiple && (!Array.isArray(body.dayOfWeeks) || body.dayOfWeeks.length === 0 || body.dayOfWeeks.length > 7 || body.dayOfWeeks.some((day) => typeof day !== "string" || !WEEKDAYS.includes(day as WeeklyClassDay)))) return Response.json({ error: "Seleccioná entre uno y siete días válidos." }, { status: 400 });
    const selectedDays = multiple ? [...new Set(body.dayOfWeeks as WeeklyClassDay[])] : [parsed.data.dayOfWeek];
    if (multiple && selectedDays.length !== (body.dayOfWeeks as unknown[]).length) return Response.json({ error: "No repitas días en la selección." }, { status: 400 });
    const { studentIds, ...scheduleData } = parsed.data;
    const schedules = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${workspaceId}))`;
      if (!await studentsExist(transaction, studentIds, workspaceId)) throw new UnknownStudentError();
      const existing = await transaction.weeklyClassSchedule.findMany({ where: { workspaceId, archivedAt: null, dayOfWeek: { in: selectedDays } }, select: { dayOfWeek: true, startTime: true, endTime: true, classType: true } });
      const conflict = existing.find((item) => item.startTime < scheduleData.endTime && scheduleData.startTime < item.endTime && item.classType.trim().toLocaleLowerCase("es") === scheduleData.classType.toLocaleLowerCase("es"));
      if (conflict) throw new DuplicateScheduleError("Ese tipo de clase ya tiene un horario superpuesto en uno de los días seleccionados.");
      const created = [];
      for (const dayOfWeek of selectedDays) created.push(await transaction.weeklyClassSchedule.create({
        data: { workspaceId, ...scheduleData, dayOfWeek, assignments: { create: studentIds.map((studentId) => ({ studentId })) } },
        include: weeklyClassInclude,
      }));
      return created;
    }, { timeout: 15000 });
    return Response.json(multiple ? schedules.map(serializeWeeklyClass) : serializeWeeklyClass(schedules[0]), { status: 201 });
  } catch (error) {
    console.error("Error al crear horario semanal", error);
    if (error instanceof SyntaxError) return Response.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
    if (error instanceof UnknownStudentError) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 400 });
    if (error instanceof DuplicateScheduleError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: databaseError(error) ? "Neon no está disponible temporalmente." : "No se pudo crear el horario semanal." }, { status: databaseError(error) ? 503 : 500 });
  }
}
