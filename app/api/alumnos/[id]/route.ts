import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { duplicatePhone, getStudentPlanOptions, normalizePhone, parseStudentInput, serializeStudent, studentInclude, studentJsonData } from "@/lib/student-enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class EnrollmentError extends Error {}

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

function missingRecord(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

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
      const current = await transaction.studentRecord.findUnique({ where: { id }, select: { id: true, primaryScheduleId: true } });
      if (!current) throw new EnrollmentError("Alumno no encontrado.");
      if (normalizedPhone && await duplicatePhone(transaction, normalizedPhone, id)) throw new EnrollmentError("Ya existe otro alumno registrado con ese teléfono.");
      const schedule = input.scheduleId
        ? await transaction.weeklyClassSchedule.findUnique({
            where: { id: input.scheduleId },
            select: { id: true, active: true, capacity: true, assignments: { where: { studentId: id }, select: { studentId: true } }, _count: { select: { assignments: true } } },
          })
        : null;
      if (input.scheduleId && !schedule) throw new EnrollmentError("El horario seleccionado ya no existe.");
      if (input.scheduleId && schedule && !schedule.active && current.primaryScheduleId !== schedule.id) throw new EnrollmentError("No podés asignar un horario inactivo como grupo principal.");
      if (input.scheduleId && schedule && schedule.assignments.length === 0 && schedule.capacity !== null && schedule._count.assignments >= schedule.capacity) throw new EnrollmentError("El horario seleccionado ya alcanzó su cupo.");
      const updated = await transaction.studentRecord.update({
        where: { id },
        data: { phoneNormalized: normalizedPhone || null, primaryScheduleId: input.scheduleId || null, data: studentJsonData(input) },
        include: studentInclude,
      });
      if (input.scheduleId && schedule) {
        await transaction.weeklyClassAssignment.upsert({ where: { scheduleId_studentId: { scheduleId: schedule.id, studentId: id } }, create: { scheduleId: schedule.id, studentId: id }, update: {} });
      }
      return updated;
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

export async function PATCH(request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  return PUT(request, context);
}

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
