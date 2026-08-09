import { Prisma } from "@prisma/client";
import { blockData, databaseUnavailable, exerciseData, normalizedBlocks, routineData, routineFingerprint, routineInclude, routineVersionSnapshot, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function changeSummary(previous: RoutineInput, next: RoutineInput) {
  const changes: string[] = [];
  if (previous.name !== next.name) changes.push("nombre");
  if (previous.objective !== next.objective) changes.push("objetivo");
  if (previous.level !== next.level) changes.push("nivel");
  if (previous.status !== next.status) changes.push("estado");
  if (previous.startDate !== next.startDate || previous.durationWeeks !== next.durationWeeks) changes.push("planificación");
  if ([...previous.priorityMuscles].sort().join("|") !== [...next.priorityMuscles].sort().join("|")) changes.push("músculos prioritarios");
  if ([...previous.studentIds].sort().join("|") !== [...next.studentIds].sort().join("|")) changes.push("asignaciones");
  if (routineFingerprint({ ...previous, name: next.name, objective: next.objective, level: next.level, status: next.status, studentIds: next.studentIds }) !== routineFingerprint(next)) changes.push("días o ejercicios");
  return changes.length ? `Cambios en ${changes.join(", ")}` : "Rutina actualizada";
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
    const input = await request.json() as RoutineInput & { replaceActive?: boolean };
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const students = input.kind === "template" ? 0 : await prisma.studentRecord.count({ where: { id: { in: input.studentIds } } });
    if (input.kind === "assigned" && students !== input.studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.trainingRoutine.findUnique({
        where: { id },
        include: {
          assignments: true,
          days: {
            include: {
              workoutSessions: { select: { id: true }, take: 1 },
              blocks: {
                include: {
                  workoutLogs: { select: { id: true }, take: 1 },
                  exercises: {
                    include: { workoutLogs: { select: { id: true }, take: 1 }, followUpComments: { select: { id: true }, take: 1 } },
                  },
                },
              },
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
      const updateInput = existing.status === "ACTIVA" ? { ...input, status: "activa" as const } : input;
      if ((existing.kind === "TEMPLATE" ? "template" : "assigned") !== updateInput.kind) throw new Error("ROUTINE_KIND_IMMUTABLE");
      const currentInput: RoutineInput = {
        name: existing.name,
        kind: existing.kind === "TEMPLATE" ? "template" : "assigned",
        description: existing.description,
        objective: existing.objective,
        level: ({ PRINCIPIANTE: "principiante", INTERMEDIO: "intermedio", AVANZADO: "avanzado" } as const)[existing.level],
        status: ({ BORRADOR: "borrador", ACTIVA: "activa", FINALIZADA: "finalizada", ARCHIVADA: "archivada" } as const)[existing.status],
        startDate: existing.startDate?.toISOString().slice(0, 10) ?? "",
        durationWeeks: existing.durationWeeks,
        priorityMuscles: existing.priorityMuscles,
        location: existing.location,
        equipment: existing.equipment,
        tags: existing.tags,
        studentIds: existing.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.studentId),
        days: existing.days.filter((day) => day.active).sort((left, right) => left.dayNumber - right.dayNumber).map((day) => ({
          id: day.id,
          dayNumber: day.dayNumber,
          name: day.name.trim() || `Día ${day.dayNumber}`,
          objective: day.objective,
          warmup: day.warmup,
          observations: day.observations,
          estimatedMinutes: day.estimatedMinutes,
          blocks: day.blocks.filter((block) => block.active).sort((left, right) => left.order - right.order).map((block) => ({
            id: block.id,
            type: block.type,
            name: block.name,
            order: block.order,
            rounds: block.rounds,
            durationSeconds: block.durationSeconds,
            workSeconds: block.workSeconds,
            restSeconds: block.restSeconds,
            restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
            targetRounds: block.targetRounds,
            instructions: block.instructions,
            exercises: block.exercises.filter((exercise) => exercise.active).sort((left, right) => left.order - right.order).map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              muscleGroup: exercise.muscleGroup,
              sets: exercise.sets,
              repetitions: exercise.repetitions,
              weight: exercise.weight === null ? null : Number(exercise.weight),
              effortType: exercise.effortType,
              effortValue: exercise.effortValue === null ? null : Number(exercise.effortValue),
              restSeconds: exercise.restSeconds,
              observations: exercise.observations,
              videoUrl: exercise.videoUrl ?? "",
              tempo: exercise.tempo ?? "",
              alternativeExercise: exercise.alternativeExercise ?? "",
              equipment: exercise.equipment ?? "",
              optional: exercise.optional,
              targetType: exercise.targetType,
              targetSeconds: exercise.targetSeconds,
              targetRepetitions: exercise.targetRepetitions ?? "",
              targetDistance: exercise.targetDistance ?? "",
              targetSide: exercise.targetSide ?? "",
              order: exercise.order,
            })),
          })),
          exercises: day.exercises.filter((exercise) => exercise.active).sort((left, right) => left.order - right.order).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: exercise.sets,
            repetitions: exercise.repetitions,
            weight: exercise.weight === null ? null : Number(exercise.weight),
            effortType: exercise.effortType,
            effortValue: exercise.effortValue === null ? null : Number(exercise.effortValue),
            restSeconds: exercise.restSeconds,
            observations: exercise.observations,
            videoUrl: exercise.videoUrl ?? "",
            tempo: exercise.tempo ?? "",
            alternativeExercise: exercise.alternativeExercise ?? "",
            equipment: exercise.equipment ?? "",
            optional: exercise.optional,
            targetType: exercise.targetType,
            targetSeconds: exercise.targetSeconds,
            targetRepetitions: exercise.targetRepetitions ?? "",
            targetDistance: exercise.targetDistance ?? "",
            targetSide: exercise.targetSide ?? "",
            order: exercise.order,
          })),
        })),
      };
      const currentFingerprint = routineFingerprint(currentInput);
      const nextFingerprint = routineFingerprint(updateInput);
      if (currentFingerprint === nextFingerprint) return transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude });
      if (updateInput.kind === "assigned" && updateInput.status === "activa") {
        const conflicts = await transaction.trainingRoutineAssignment.findMany({ where: { routineId: { not: id }, studentId: { in: updateInput.studentIds }, active: true, routine: { status: "ACTIVA", kind: "ASSIGNED" } }, select: { routineId: true, studentId: true } });
        if (conflicts.length && !updateInput.replaceActive) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
        if (conflicts.length) {
          await transaction.trainingRoutineAssignment.updateMany({ where: { OR: conflicts.map((conflict) => ({ routineId: conflict.routineId, studentId: conflict.studentId })) }, data: { active: false, archivedAt: new Date() } });
          for (const conflictRoutineId of new Set(conflicts.map((conflict) => conflict.routineId))) {
            const remaining = await transaction.trainingRoutineAssignment.count({ where: { routineId: conflictRoutineId, active: true } });
            if (!remaining) await transaction.trainingRoutine.update({ where: { id: conflictRoutineId }, data: { status: "FINALIZADA" } });
          }
        }
      }

      const transitionAt = updateInput.status === "archivada" ? existing.archivedAt ?? new Date() : null;
      await transaction.trainingRoutine.update({ where: { id }, data: { ...routineData(updateInput), archivedAt: transitionAt } });
      const retainedDayIds = new Set<string>();
      const hasStableDayIds = updateInput.days.some((day) => Boolean(day.id));
      await transaction.trainingRoutineDay.updateMany({ where: { routineId: id, active: true }, data: { active: false } });

      for (const dayInput of updateInput.days) {
        const existingDay = existing.days.find((day) => day.id === dayInput.id)
          ?? (!hasStableDayIds ? existing.days.find((day) => day.dayNumber === dayInput.dayNumber) : undefined);
        const day = existingDay
          ? await transaction.trainingRoutineDay.update({
            where: { id: existingDay.id },
            data: { dayNumber: dayInput.dayNumber, name: dayInput.name.trim(), objective: dayInput.objective.trim(), warmup: dayInput.warmup?.trim() ?? "", observations: dayInput.observations.trim(), estimatedMinutes: dayInput.estimatedMinutes, active: true, archivedAt: null },
          })
          : await transaction.trainingRoutineDay.create({
            data: { routineId: id, dayNumber: dayInput.dayNumber, name: dayInput.name.trim(), objective: dayInput.objective.trim(), warmup: dayInput.warmup?.trim() ?? "", observations: dayInput.observations.trim(), estimatedMinutes: dayInput.estimatedMinutes },
          });
        retainedDayIds.add(day.id);

        const retainedBlockIds = new Set<string>();
        const retainedExerciseIds = new Set<string>();
        if (existingDay) await transaction.trainingRoutineBlock.updateMany({ where: { routineDayId: existingDay.id, active: true }, data: { active: false } });
        for (const blockInput of normalizedBlocks(dayInput)) {
          const existingBlock = existingDay?.blocks.find((block) => block.id === blockInput.id);
          const block = existingBlock
            ? await transaction.trainingRoutineBlock.update({ where: { id: existingBlock.id }, data: { ...blockData(blockInput), active: true, archivedAt: null } })
            : await transaction.trainingRoutineBlock.create({ data: { routineDayId: day.id, ...blockData(blockInput) } });
          retainedBlockIds.add(block.id);
          for (const exerciseInput of [...blockInput.exercises].sort((left, right) => left.order - right.order)) {
            const existingExercise = existingDay?.exercises.find((exercise) => exercise.id === exerciseInput.id);
            const exercise = existingExercise
              ? await transaction.trainingRoutineExercise.update({ where: { id: existingExercise.id }, data: { blockId: block.id, ...exerciseData(exerciseInput), active: true, archivedAt: null } })
              : await transaction.trainingRoutineExercise.create({ data: { dayId: day.id, blockId: block.id, ...exerciseData(exerciseInput) } });
            retainedExerciseIds.add(exercise.id);
          }
        }

        for (const removed of existingDay?.exercises.filter((exercise) => exercise.active && !retainedExerciseIds.has(exercise.id)) ?? []) {
          const hasHistory = removed.workoutLogs.length > 0 || removed.followUpComments.length > 0;
          if (hasHistory) await transaction.trainingRoutineExercise.update({ where: { id: removed.id }, data: { active: false, archivedAt: new Date() } });
          else await transaction.trainingRoutineExercise.delete({ where: { id: removed.id } });
        }
        for (const removed of existingDay?.blocks.filter((block) => block.active && !retainedBlockIds.has(block.id)) ?? []) {
          const hasHistory = removed.workoutLogs.length > 0 || removed.exercises.some((exercise) => exercise.workoutLogs.length > 0 || exercise.followUpComments.length > 0);
          if (hasHistory) await transaction.trainingRoutineBlock.update({ where: { id: removed.id }, data: { active: false, archivedAt: new Date() } });
          else await transaction.trainingRoutineBlock.delete({ where: { id: removed.id } });
        }
      }

      for (const removedDay of existing.days.filter((day) => day.active && !retainedDayIds.has(day.id))) {
        const hasHistory = removedDay.workoutSessions.length > 0 || removedDay.exercises.some((exercise) => exercise.workoutLogs.length > 0 || exercise.followUpComments.length > 0);
        if (hasHistory) {
          await transaction.trainingRoutineDay.update({ where: { id: removedDay.id }, data: { active: false, archivedAt: new Date() } });
          await transaction.trainingRoutineBlock.updateMany({ where: { routineDayId: removedDay.id, active: true }, data: { active: false, archivedAt: new Date() } });
          await transaction.trainingRoutineExercise.updateMany({ where: { dayId: removedDay.id, active: true }, data: { active: false, archivedAt: new Date() } });
        } else {
          await transaction.trainingRoutineDay.delete({ where: { id: removedDay.id } });
        }
      }

      const selectedStudentIds = new Set(updateInput.kind === "assigned" ? updateInput.studentIds : []);
      for (const assignment of existing.assignments) {
        const shouldBeActive = updateInput.status !== "archivada" && updateInput.status !== "finalizada" && selectedStudentIds.has(assignment.studentId);
        await transaction.trainingRoutineAssignment.update({
          where: { routineId_studentId: { routineId: id, studentId: assignment.studentId } },
          data: {
            active: shouldBeActive,
            archivedAt: shouldBeActive ? null : updateInput.status === "archivada" && assignment.active ? transitionAt : assignment.archivedAt ?? new Date(),
          },
        });
      }
      if (updateInput.kind === "assigned" && (updateInput.status === "activa" || updateInput.status === "borrador")) {
        const existingStudentIds = new Set(existing.assignments.map((assignment) => assignment.studentId));
        const newStudentIds = updateInput.studentIds.filter((studentId) => !existingStudentIds.has(studentId));
        if (newStudentIds.length) await transaction.trainingRoutineAssignment.createMany({ data: newStudentIds.map((studentId) => ({ routineId: id, studentId })) });
      }
      const latestVersion = await transaction.trainingRoutineVersion.aggregate({ where: { routineId: id }, _max: { version: true } });
      let version = latestVersion._max.version ?? 0;
      if (version === 0) {
        version = 1;
        await transaction.trainingRoutineVersion.create({
          data: { routineId: id, version, summary: "Estado anterior al primer cambio", fingerprint: currentFingerprint, snapshot: routineVersionSnapshot(currentInput) as unknown as Prisma.InputJsonValue },
        });
      }
      await transaction.trainingRoutineVersion.create({
        data: {
          routineId: id,
          version: version + 1,
          summary: changeSummary(currentInput, updateInput),
          fingerprint: nextFingerprint,
          snapshot: routineVersionSnapshot(updateInput) as unknown as Prisma.InputJsonValue,
        },
      });
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id }, include: routineInclude });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Uno o más alumnos ya tienen otra rutina activa asignada." }, { status: 409 });
    if (error instanceof Error && error.message === "ROUTINE_KIND_IMMUTABLE") return Response.json({ error: "No se puede convertir una rutina en plantilla desde la edición. Usá “Guardar como plantilla”." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La rutina cambió al mismo tiempo. Recargá e intentá nuevamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") return Response.json({ error: "La actualización tardó más de lo esperado y fue revertida de forma segura. Intentá nuevamente." }, { status: 503 });
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
    const input = await request.json() as { action?: "archive" | "restore" | "restoreVersion"; versionId?: string };
    if (input.action === "restoreVersion") {
      if (!input.versionId?.trim()) return Response.json({ error: "La versión seleccionada no es válida." }, { status: 400 });
      const version = await prisma.trainingRoutineVersion.findFirst({ where: { id: input.versionId, routineId: id }, select: { snapshot: true } });
      const routine = await prisma.trainingRoutine.findUnique({ where: { id }, select: { status: true } });
      if (!version || !routine) return Response.json({ error: "Rutina o versión no encontrada." }, { status: 404 });
      const snapshot = version.snapshot as unknown as Partial<RoutineInput>;
      if (!snapshot.name || !snapshot.objective || !snapshot.level || !Array.isArray(snapshot.days) || !Array.isArray(snapshot.studentIds)) {
        return Response.json({ error: "La versión seleccionada no contiene una rutina válida." }, { status: 400 });
      }
      const restoredInput: RoutineInput = {
        name: snapshot.name,
        kind: snapshot.kind ?? "assigned",
        description: snapshot.description ?? "",
        objective: snapshot.objective,
        level: snapshot.level,
        status: ({ BORRADOR: "borrador", ACTIVA: "activa", FINALIZADA: "finalizada", ARCHIVADA: "archivada" } as const)[routine.status],
        startDate: snapshot.startDate ?? "",
        durationWeeks: snapshot.durationWeeks ?? null,
        priorityMuscles: snapshot.priorityMuscles ?? [],
        location: snapshot.location ?? "",
        equipment: snapshot.equipment ?? [],
        tags: snapshot.tags ?? [],
        studentIds: snapshot.studentIds,
        days: snapshot.days.map((day) => ({
          ...day,
          name: day.name?.trim() || `Día ${day.dayNumber}`,
          objective: day.objective ?? "",
          warmup: day.warmup ?? "",
          observations: day.observations ?? "",
          estimatedMinutes: day.estimatedMinutes ?? null,
        })),
      };
      return PUT(new Request(request.url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(restoredInput) }), context);
    }
    if (input.action === "archive") {
      const record = await prisma.$transaction(async (transaction) => {
        const current = await transaction.trainingRoutine.findUnique({ where: { id }, select: { status: true } });
        if (!current) throw new Prisma.PrismaClientKnownRequestError("Rutina no encontrada", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
        if (current.status === "ARCHIVADA") throw new Error("ALREADY_ARCHIVED");
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
    if (error instanceof Error && error.message === "ALREADY_ARCHIVED") return Response.json({ error: "La rutina ya está archivada." }, { status: 409 });
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
        select: { id: true, status: true, _count: { select: { workoutSessions: true } } },
      });
      if (!routine) return null;
      if (routine.status !== "ARCHIVADA") throw new Error("ARCHIVE_FIRST");
      await transaction.trainingRoutine.delete({ where: { id } });
      return { deletedSessionsPreserved: routine._count.workoutSessions };
    });
    if (!result) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json({ action: "deleted", message: "Rutina eliminada definitivamente", preservedWorkoutSessions: result.deletedSessionsPreserved });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (error instanceof Error && error.message === "ARCHIVE_FIRST") return Response.json({ error: "Archivá la rutina antes de eliminarla definitivamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al eliminar rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al eliminar rutina", error);
    const unavailable = databaseUnavailable(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return Response.json({ error: "No se pudo eliminar la rutina porque todavía tiene una relación no preservable." }, { status: 409 });
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la rutina." }, { status: unavailable ? 503 : 500 });
  }
}
