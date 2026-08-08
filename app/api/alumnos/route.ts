import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { duplicatePhone, getStudentPlanOptions, normalizePhone, parseStudentInput, serializeStudent, studentInclude, studentJsonData } from "@/lib/student-enrollment";
import { recordInitialStudentHistory } from "@/lib/student-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class EnrollmentError extends Error {}
function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const records = await prisma.studentRecord.findMany({ include: studentInclude, orderBy: { updatedAt: "desc" } });
    return Response.json(records.map(serializeStudent));
  } catch (error) {
    console.error("Error al consultar alumnos", error);
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudieron cargar los alumnos." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const plans = await getStudentPlanOptions();
    const parsed = parseStudentInput(await request.json(), plans);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;
    const normalizedPhone = normalizePhone(input.phone);
    const record = await prisma.$transaction(async (transaction) => {
      if (normalizedPhone && await duplicatePhone(transaction, normalizedPhone)) throw new EnrollmentError("Ya existe un alumno registrado con ese teléfono.");
      const schedules = input.scheduleIds.length ? await transaction.weeklyClassSchedule.findMany({
        where: { id: { in: input.scheduleIds } },
        select: { id: true, active: true, capacity: true, _count: { select: { assignments: { where: { active: true } } } } },
      }) : [];
      if (schedules.length !== input.scheduleIds.length) throw new EnrollmentError("El horario seleccionado no es válido.");
      if (schedules.some((schedule) => !schedule.active)) throw new EnrollmentError("Seleccioná únicamente horarios activos para el alta.");
      if (schedules.some((schedule) => schedule.capacity !== null && schedule._count.assignments >= schedule.capacity)) throw new EnrollmentError("Uno de los horarios seleccionados ya alcanzó su cupo.");
      const created = await transaction.studentRecord.create({
        data: { id: randomUUID(), phoneNormalized: normalizedPhone || null, primaryScheduleId: input.scheduleIds[0] ?? null, serviceType: input.serviceType, data: studentJsonData(input) },
      });
      await recordInitialStudentHistory(transaction, created.id, input);
      if (schedules.length) await transaction.weeklyClassAssignment.createMany({ data: schedules.map((schedule) => ({ scheduleId: schedule.id, studentId: created.id })) });
      return transaction.studentRecord.findUniqueOrThrow({ where: { id: created.id }, include: studentInclude });
    });
    return Response.json(serializeStudent(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear alumno", error);
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
    if (error instanceof EnrollmentError) return Response.json({ error: error.message }, { status: error.message.includes("teléfono") ? 409 : 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ya existe un alumno registrado con ese teléfono." }, { status: 409 });
    return Response.json({ error: databaseUnavailable(error) ? "La base de datos no está disponible temporalmente." : "No se pudo guardar el alumno." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}
