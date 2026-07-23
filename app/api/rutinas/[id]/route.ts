import { Prisma } from "@prisma/client";
import { databaseUnavailable, exerciseData, routineData, routineInclude, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.trainingRoutine.findUnique({ where: { id }, include: routineInclude });
    if (!record) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    console.error("Error al consultar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar la rutina desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const input = await request.json() as RoutineInput;
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const students = await prisma.studentRecord.count({ where: { id: { in: input.studentIds } } });
    if (students !== input.studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.trainingRoutine.findUnique({
        where: { id },
        include: {
          assignments: true,
          days: {
            include: {
              workoutSessions: { select: { id: true }, take: 1 },
              exercises: {
                include: {
                  workoutLogs: { select: { id: true }, take: 1 },
                  followUpComments: { select: { id: true }, take: 1 },
                },
              },
            },
          },
        },
      });
      if (!existing) throw new Prisma.PrismaClientKnownRequestError("Rutina no encontrada", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      await transaction.trainingRoutine.update({ where: { id }, data: routineData(input) });
      const retainedDayIds = new Set<string>();

      for (const dayInput of input.days) {
        const existingDay = existing.days.find((day) => day.id === dayInput.id) ?? existing.days.find((day) => day.dayNumber === dayInput.dayNumber);
        const day = existingDay
          ? await transaction.trainingRoutineDay.update({ where: { id: existingDay.id }, data: { dayNumber: dayInput.dayNumber, active: true, archivedAt: null } })
          : await transaction.trainingRoutineDay.create({ data: { routineId: id, dayNumber: dayInput.dayNumber } });
        retainedDayIds.add(day.id);

        const retainedExerciseIds = new Set<string>();
        for (const exerciseInput of [...dayInput.exercises].sort((left, right) => left.order - right.order)) {
          const existingExercise = existingDay?.exercises.find((exercise) => exercise.id === exerciseInput.id);
          const exercise = existingExercise
            ? await transaction.trainingRoutineExercise.update({ where: { id: existingExercise.id }, data: { ...exerciseData(exerciseInput), active: true, archivedAt: null } })
            : await transaction.trainingRoutineExercise.create({ data: { dayId: day.id, ...exerciseData(exerciseInput) } });
          retainedExerciseIds.add(exercise.id);
        }

        for (const removed of existingDay?.exercises.filter((exercise) => exercise.active && !retainedExerciseIds.has(exercise.id)) ?? []) {
          const hasHistory = removed.workoutLogs.length > 0 || removed.followUpComments.length > 0;
          if (hasHistory) await transaction.trainingRoutineExercise.update({ where: { id: removed.id }, data: { active: false, archivedAt: new Date() } });
          else await transaction.trainingRoutineExercise.delete({ where: { id: removed.id } });
        }
      }

      for (const removedDay of existing.days.filter((day) => day.active && !retainedDayIds.has(day.id))) {
        const hasHistory = removedDay.workoutSessions.length > 0 || removedDay.exercises.some((exercise) => exercise.workoutLogs.length > 0 || exercise.followUpComments.length > 0);
        if (hasHistory) {
          await transaction.trainingRoutineDay.update({ where: { id: removedDay.id }, data: { active: false, archivedAt: new Date() } });
          await transaction.trainingRoutineExercise.updateMany({ where: { dayId: removedDay.id, active: true }, data: { active: false, archivedAt: new Date() } });
        } else {
          await transaction.trainingRoutineDay.delete({ where: { id: removedDay.id } });
        }
      }

      const existingStudentIds = new Set(existing.assignments.map((assignment) => assignment.studentId));
      await transaction.trainingRoutineAssignment.deleteMany({ where: { routineId: id, studentId: { notIn: input.studentIds } } });
      const newStudentIds = input.studentIds.filter((studentId) => !existingStudentIds.has(studentId));
      if (newStudentIds.length) await transaction.trainingRoutineAssignment.createMany({ data: newStudentIds.map((studentId) => ({ routineId: id, studentId })) });
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude });
    });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al actualizar rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al actualizar rutina", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error);
    const unavailable = databaseUnavailable(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return Response.json({ error: "No se puede retirar ese día o ejercicio porque tiene historial asociado. El historial no fue modificado." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "La rutina contiene días o ejercicios duplicados. Revisá la estructura e intentá nuevamente." }, { status: 409 });
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo actualizar la rutina. El historial fue preservado; revisá los datos e intentá nuevamente." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  return PUT(request, context);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    await prisma.trainingRoutine.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al eliminar rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al eliminar rutina", error);
    const unavailable = databaseUnavailable(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return Response.json({ error: "No se puede eliminar una rutina con historial de entrenamientos. Archivala para conservar los registros." }, { status: 409 });
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la rutina." }, { status: unavailable ? 503 : 500 });
  }
}
