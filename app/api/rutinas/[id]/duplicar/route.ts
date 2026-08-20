import { Prisma } from "@prisma/client";
import { createRoutineDays, databaseUnavailable, routineFingerprint, routineInclude, routineVersionSnapshot, serializeRoutine, validateRoutine, type ExerciseInput, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CopyMode = "duplicate" | "saveAsTemplate" | "useTemplate";
type CopyRequest = {
  mode?: CopyMode;
  name?: string;
  studentIds?: string[];
  startDate?: string;
  status?: "borrador" | "activa";
  resetWeights?: boolean;
  replaceActive?: boolean;
};

function copyName(name: string) {
  const base = name
    .replace(/^\s*Copia de\s+/i, "")
    .replace(/(?:\s*\(\s*copia\s*\))+\s*$/gi, "")
    .trim();
  return `Copia de ${base || "rutina"}`;
}

export async function POST(request: Request, context: RouteContext<"/api/rutinas/[id]/duplicar">) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as CopyRequest;
    const mode = body.mode ?? "duplicate";
    const source = await prisma.trainingRoutine.findUnique({ where: { id }, include: routineInclude });
    if (!source) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    if (mode === "useTemplate" && source.kind !== "TEMPLATE") return Response.json({ error: "La rutina seleccionada no es una plantilla." }, { status: 400 });

    const targetKind = mode === "saveAsTemplate" || (mode === "duplicate" && source.kind === "TEMPLATE") ? "template" : "assigned";
    const requestedStudentIds = targetKind === "assigned" && Array.isArray(body.studentIds)
      ? body.studentIds.map((studentId) => studentId.trim()).filter(Boolean)
      : [];
    if (new Set(requestedStudentIds).size !== requestedStudentIds.length) return Response.json({ error: "La selección contiene alumnos repetidos." }, { status: 400 });
    if (mode === "useTemplate" && !requestedStudentIds.length) return Response.json({ error: "Seleccioná al menos un alumno destino." }, { status: 400 });
    const existingStudents = requestedStudentIds.length ? await prisma.studentRecord.count({ where: { id: { in: requestedStudentIds } } }) : 0;
    if (existingStudents !== requestedStudentIds.length) return Response.json({ error: "Uno o más alumnos destino ya no existen." }, { status: 404 });

    const days = source.days.map((day) => ({
      dayNumber: day.dayNumber,
      name: day.name.trim() || `Día ${day.dayNumber}`,
      objective: day.objective,
      warmup: day.warmup,
      observations: day.observations,
      estimatedMinutes: day.estimatedMinutes,
      blocks: day.blocks.map((block) => ({
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
        exercises: block.exercises.map((exercise): ExerciseInput => ({
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: exercise.sets,
        repetitions: exercise.repetitions,
        weight: body.resetWeights ? null : exercise.weight === null ? null : Number(exercise.weight),
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
      exercises: [],
    }));
    const input: RoutineInput = {
      name: body.name?.trim() || copyName(source.name),
      kind: targetKind,
      description: source.description,
      objective: source.objective,
      level: ({ PRINCIPIANTE: "principiante", INTERMEDIO: "intermedio", AVANZADO: "avanzado" } as const)[source.level],
      status: targetKind === "template" ? "borrador" : body.status ?? "borrador",
      startDate: body.startDate ?? source.startDate?.toISOString().slice(0, 10) ?? "",
      durationWeeks: source.durationWeeks,
      priorityMuscles: source.priorityMuscles,
      location: source.location,
      equipment: source.equipment,
      tags: source.tags,
      studentIds: requestedStudentIds,
      days,
    };
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const copy = await prisma.$transaction(async (transaction) => {
      if (requestedStudentIds.length && input.status === "activa") {
        const conflicts = await transaction.trainingRoutineAssignment.findMany({
          where: { studentId: { in: requestedStudentIds }, active: true, routine: { status: "ACTIVA", kind: "ASSIGNED" } },
          select: { routineId: true, studentId: true },
        });
        if (conflicts.length && !body.replaceActive) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
        if (conflicts.length) {
          await transaction.trainingRoutineAssignment.updateMany({ where: { OR: conflicts.map((item) => ({ studentId: item.studentId, routineId: item.routineId })) }, data: { active: false, archivedAt: new Date() } });
          for (const conflict of conflicts) {
            const others = await transaction.trainingRoutineAssignment.count({ where: { routineId: conflict.routineId, active: true } });
            if (!others) await transaction.trainingRoutine.update({ where: { id: conflict.routineId }, data: { status: "FINALIZADA" } });
          }
        }
      }
      const created = await transaction.trainingRoutine.create({
        data: {
          name: input.name,
          kind: input.kind === "template" ? "TEMPLATE" : "ASSIGNED",
          description: input.description,
          objective: input.objective,
          level: source.level,
          status: input.status === "activa" ? "ACTIVA" : "BORRADOR",
          startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null,
          durationWeeks: input.durationWeeks,
          priorityMuscles: input.priorityMuscles,
          location: input.location,
          equipment: input.equipment,
          tags: input.tags,
          assignments: requestedStudentIds.length ? { create: requestedStudentIds.map((studentId) => ({ studentId, active: true, archivedAt: null })) } : undefined,
        },
      });
      await createRoutineDays(transaction, created.id, days);
      await transaction.trainingRoutineVersion.create({
        data: { routineId: created.id, version: 1, summary: mode === "saveAsTemplate" ? "Plantilla creada desde una rutina" : "Copia independiente creada", fingerprint: routineFingerprint(input), snapshot: routineVersionSnapshot(input) as unknown as Prisma.InputJsonValue },
      });
      return transaction.trainingRoutine.findUniqueOrThrow({ where: { id: created.id }, include: routineInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json(serializeRoutine(copy), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Este alumno ya tiene una rutina activa.", code: "ACTIVE_ASSIGNMENT_CONFLICT" }, { status: 409 });
    console.error("Error al copiar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo crear la copia independiente." }, { status: unavailable ? 503 : 500 });
  }
}
