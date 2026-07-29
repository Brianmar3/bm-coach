import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { duplicatePhone, getStudentPlanOptions, normalizePhone, parseStudentInput, serializeStudent, studentInclude, studentJsonData } from "@/lib/student-enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class EnrollmentError extends Error {}
const databaseUnavailable = (error: unknown) => error instanceof Prisma.PrismaClientInitializationError || (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
const missingRecord = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export async function GET(_request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.studentRecord.findUnique({ where: { id }, include: studentInclude });
    if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json(serializeStudent(record));
  } catch (error) {
    console.error("Error al consultar alumno", error);
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo cargar el alumno." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  try {
    const { id } = await context.params;
    const plans = await getStudentPlanOptions();
    const parsed = parseStudentInput(await request.json(), plans);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;
    const normalizedPhone = normalizePhone(input.phone);
    const record = await prisma.$transaction(async (transaction) => {
      const current = await transaction.studentRecord.findUnique({ where: { id }, select: { id: true, data: true } });
      if (!current) throw new EnrollmentError("Alumno no encontrado.");
      if (normalizedPhone && await duplicatePhone(transaction, normalizedPhone, id)) throw new EnrollmentError("Ya existe otro alumno registrado con ese teléfono.");
      const schedules = input.scheduleIds.length ? await transaction.weeklyClassSchedule.findMany({
        where: { id: { in: input.scheduleIds } },
        select: { id: true, active: true, capacity: true, assignments: { where: { studentId: id }, select: { active: true } }, _count: { select: { assignments: { where: { active: true } } } } },
      }) : [];
      if (schedules.length !== input.scheduleIds.length) throw new EnrollmentError("Uno de los horarios seleccionados ya no existe.");
      if (schedules.some((schedule) => !schedule.active && !schedule.assignments.some((assignment) => assignment.active))) throw new EnrollmentError("No podés agregar un horario inactivo.");
      if (schedules.some((schedule) => !schedule.assignments.some((assignment) => assignment.active) && schedule.capacity !== null && schedule._count.assignments >= schedule.capacity)) throw new EnrollmentError("Uno de los horarios seleccionados ya alcanzó su cupo.");
      await transaction.studentRecord.update({
        where: { id },
        data: { phoneNormalized: normalizedPhone || null, primaryScheduleId: input.scheduleIds[0] ?? null, serviceType: input.serviceType, data: { ...(current.data as Prisma.JsonObject), ...studentJsonData(input) } },
      });
      await transaction.weeklyClassAssignment.updateMany({ where: { studentId: id, active: true, scheduleId: { notIn: input.scheduleIds } }, data: { active: false, endedAt: new Date() } });
      for (const schedule of schedules) {
        await transaction.weeklyClassAssignment.upsert({
          where: { scheduleId_studentId: { scheduleId: schedule.id, studentId: id } },
          create: { scheduleId: schedule.id, studentId: id },
          update: { active: true, endedAt: null },
        });
      }
      return transaction.studentRecord.findUniqueOrThrow({ where: { id }, include: studentInclude });
    });
    return Response.json(serializeStudent(record));
  } catch (error) {
    console.error("Error al actualizar alumno", error);
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
    if (error instanceof EnrollmentError) return Response.json({ error: error.message }, { status: error.message.includes("teléfono") ? 409 : error.message === "Alumno no encontrado." ? 404 : 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ya existe otro alumno registrado con ese teléfono." }, { status: 409 });
    if (missingRecord(error)) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo actualizar el alumno." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/alumnos/[id]">) { return PUT(request, context); }
export async function DELETE(_request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  try {
    const { id } = await context.params;
    await prisma.studentRecord.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error al eliminar alumno", error);
    if (missingRecord(error)) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo eliminar el alumno porque tiene información relacionada." }, { status: databaseUnavailable(error) ? 503 : 409 });
  }
}
