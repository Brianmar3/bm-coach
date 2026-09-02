import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { duplicatePhone, getStudentPlanOptions, normalizePhone, parseStudentInput, serializeStudent, studentInclude, studentJsonData } from "@/lib/student-enrollment";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";
import { recordStudentDeactivation, recordStudentHistoryChange } from "@/lib/student-history";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";

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
      const current = await transaction.studentRecord.findUnique({ where: { id }, select: { id: true, data: true, serviceType: true } });
      if (!current) throw new EnrollmentError("Alumno no encontrado.");
      if (normalizedPhone && await duplicatePhone(transaction, normalizedPhone, id)) throw new EnrollmentError("Ya existe otro alumno registrado con ese teléfono.");
      const schedules = input.scheduleIds.length ? await transaction.weeklyClassSchedule.findMany({
        where: { id: { in: input.scheduleIds }, archivedAt: null },
        select: { id: true, active: true, capacity: true, assignments: { where: { studentId: id }, select: { active: true } }, _count: { select: { assignments: { where: { active: true } } } } },
      }) : [];
      if (schedules.length !== input.scheduleIds.length) throw new EnrollmentError("El horario seleccionado no es válido.");
      if (schedules.some((schedule) => !schedule.active && !schedule.assignments.some((assignment) => assignment.active))) throw new EnrollmentError("No podés agregar un horario inactivo.");
      if (schedules.some((schedule) => !schedule.assignments.some((assignment) => assignment.active) && schedule.capacity !== null && schedule._count.assignments >= schedule.capacity)) throw new EnrollmentError("Uno de los horarios seleccionados ya alcanzó su cupo.");
      await recordStudentHistoryChange(transaction, id, current.data, current.serviceType, input);
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
    await reconcileStudentPointsAfterMutation(id);
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
    const record = await prisma.$transaction(async (transaction) => {
      const current = await transaction.studentRecord.findUnique({ where: { id }, select: { id: true, data: true, serviceType: true } });
      if (!current) throw new EnrollmentError("Alumno no encontrado.");
      const now = new Date();
      const currentPeriod = dateKeyToDatabase(argentinaDateKey());
      await recordStudentDeactivation(transaction, id, current.data, current.serviceType);
      await Promise.all([
        transaction.weeklyClassAssignment.updateMany({ where: { studentId: id, active: true }, data: { active: false, endedAt: now } }),
        transaction.trainingRoutineAssignment.updateMany({ where: { studentId: id, active: true }, data: { active: false, archivedAt: now } }),
        transaction.studentPortalCredential.updateMany({ where: { studentId: id }, data: { active: false } }),
        transaction.studentPushSubscription.updateMany({ where: { studentId: id, active: true }, data: { active: false } }),
        transaction.monthlyStudentObligation.updateMany({
          where: { studentId: id, period: { gt: currentPeriod }, paidAmount: 0, status: { in: ["PENDING", "OVERDUE"] } },
          data: { status: "VOID", balance: 0 },
        }),
      ]);
      await transaction.studentRecord.update({
        where: { id },
        data: { primaryScheduleId: null, data: { ...(current.data as Prisma.JsonObject), status: "inactivo", lifecycleStatus: "inactivo" } },
      });
      return transaction.studentRecord.findUniqueOrThrow({ where: { id }, include: studentInclude });
    });
    return Response.json({ action: "deactivated", student: serializeStudent(record) });
  } catch (error) {
    console.error("Error al eliminar alumno", error);
    if (error instanceof EnrollmentError || missingRecord(error)) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo dar de baja al alumno." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}
