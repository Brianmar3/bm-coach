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
      if (input.status === "activa") {
        const conflicts = await transaction.trainingRoutineAssignment.count({ where: { routineId: { not: id }, studentId: { in: input.studentIds }, active: true, routine: { status: "ACTIVA" } } });
        if (conflicts) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
      }

      const transitionAt = input.status === "archivada" ? new Date() : null;
      await transaction.trainingRoutine.update({ where: { id }, data: { ...routineData(input), archivedAt: transitionAt } });
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

      const selectedStudentIds = new Set(input.studentIds);
      for (const assignment of existing.assignments) {
        const shouldBeActive = input.status === "activa" && selectedStudentIds.has(assignment.studentId);
        await transaction.trainingRoutineAssignment.update({
          where: { routineId_studentId: { routineId: id, studentId: assignment.studentId } },
          data: {
            active: shouldBeActive,
            archivedAt: shouldBeActive ? null : input.status === "archivada" && assignment.active ? transitionAt : assignment.archivedAt ?? new Date(),
          },
        });
      }
      if (input.status === "activa") {
        const existingStudentIds = new Set(existing.assignments.map((assignment) => assignment.studentId));
        const newStudentIds = input.studentIds.filter((studentId) => !existingStudentIds.has(studentId));
        if (newStudentIds.length) await transaction.trainingRoutineAssignment.createMany({ data: newStudentIds.map((studentId) => ({ routineId: id, studentId })) });
      }
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Uno o más alumnos ya tienen otra rutina activa asignada." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La rutina cambió al mismo tiempo. Recargá e intentá nuevamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al actualizar rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al actualizar rutina", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error);
    const unavailable = databaseUnavailable(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return Response.json({ error: "No se puede retirar ese día o ejercicio porque tiene historial asociado. El historial no fue modificado." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "La rutina contiene días o ejercicios duplicados. Revisá la estructura e intentá nuevamente." }, { status: 409 });
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo actualizar la rutina. El historial fue preservado; revisá los datos e intentá nuevamente." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const input = await request.json() as { action?: "archive" | "restore" };
    if (input.action === "archive") {
      const record = await prisma.$transaction(async (transaction) => {
        const archivedAt = new Date();
        await transaction.trainingRoutineAssignment.updateMany({ where: { routineId: id, active: true }, data: { active: false, archivedAt } });
        return transaction.trainingRoutine.update({ where: { id }, data: { status: "ARCHIVADA", archivedAt }, include: routineInclude });
      });
      return Response.json({ action: "archived", message: "Rutina archivada correctamente", routine: serializeRoutine(record) });
    }
    if (input.action === "restore") {
      const result = await prisma.$transaction(async (transaction) => {
        const routine = await transaction.trainingRoutine.findUnique({ where: { id }, include: { assignments: true } });
        if (!routine) return null;
        const historicalStudentIds = routine.assignments
          .filter((assignment) => routine.archivedAt && assignment.archivedAt?.getTime() === routine.archivedAt.getTime())
          .map((assignment) => assignment.studentId);
        const conflicts = historicalStudentIds.length ? await transaction.trainingRoutineAssignment.findMany({ where: { routineId: { not: id }, studentId: { in: historicalStudentIds }, active: true, routine: { status: "ACTIVA" } }, select: { studentId: true } }) : [];
        const conflictIds = new Set(conflicts.map((assignment) => assignment.studentId));
        await transaction.trainingRoutine.update({ where: { id }, data: { status: "ACTIVA", archivedAt: null } });
        const restorableIds = historicalStudentIds.filter((studentId) => !conflictIds.has(studentId));
        if (restorableIds.length) await transaction.trainingRoutineAssignment.updateMany({ where: { routineId: id, studentId: { in: restorableIds } }, data: { active: true, archivedAt: null } });
        return { record: await transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude }), skipped: conflictIds.size };
      });
      if (!result) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
      return Response.json({ action: "restored", message: result.skipped ? `Rutina restaurada. ${result.skipped} asignaciones no se reactivaron porque el alumno ya tiene otra rutina activa.` : "Rutina restaurada correctamente", routine: serializeRoutine(result.record) });
    }
    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al cambiar estado de rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al cambiar estado de rutina", error);
    return Response.json({ error: "No se pudo cambiar el estado de la rutina. No se modificó el historial." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const result = await prisma.$transaction(async (transaction) => {
      const routine = await transaction.trainingRoutine.findUnique({
        where: { id },
        include: {
          assignments: { select: { studentId: true }, take: 1 },
          workoutSessions: { select: { id: true }, take: 1 },
          days: { include: { exercises: { include: { workoutLogs: { select: { id: true }, take: 1 }, followUpComments: { select: { id: true }, take: 1 } } } } },
        },
      });
      if (!routine) return null;
      const hasHistory = routine.assignments.length > 0 || routine.workoutSessions.length > 0 || routine.days.some((day) => day.exercises.some((exercise) => exercise.workoutLogs.length > 0 || exercise.followUpComments.length > 0));
      if (hasHistory) {
        const archivedAt = new Date();
        await transaction.trainingRoutineAssignment.updateMany({ where: { routineId: id, active: true }, data: { active: false, archivedAt } });
        const archived = await transaction.trainingRoutine.update({ where: { id }, data: { status: "ARCHIVADA", archivedAt }, include: routineInclude });
        return { action: "archived" as const, routine: archived };
      }
      await transaction.trainingRoutine.delete({ where: { id } });
      return { action: "deleted" as const, routine: null };
    });
    if (!result) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(result.action === "archived"
      ? { action: "archived", message: "Rutina archivada correctamente", routine: serializeRoutine(result.routine!) }
      : { action: "deleted", message: "Rutina eliminada definitivamente" });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al eliminar rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al eliminar rutina", error);
    const unavailable = databaseUnavailable(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return Response.json({ error: "No se puede eliminar una rutina con historial de entrenamientos. Archivala para conservar los registros." }, { status: 409 });
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la rutina." }, { status: unavailable ? 503 : 500 });
  }
}
