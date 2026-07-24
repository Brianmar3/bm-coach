import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const actualValues = ["UNKNOWN", "PRESENT", "ABSENT", "CANCELLED"] as const;
const statusValues = ["SCHEDULED", "CANCELLED", "COMPLETED"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { id } = await context.params;
    const input = await request.json() as Record<string, unknown>;
    const occurrence = await prisma.classOccurrence.findUnique({ where: { id }, select: { id: true } });
    if (!occurrence) return Response.json({ error: "La clase no existe." }, { status: 404 });
    if (input.action === "attendance") {
      if (typeof input.studentId !== "string" || !actualValues.includes(input.actualAttendance as typeof actualValues[number])) return Response.json({ error: "La asistencia no es válida." }, { status: 400 });
      const student = await prisma.studentRecord.findUnique({ where: { id: input.studentId }, select: { id: true } });
      if (!student) return Response.json({ error: "El alumno no existe." }, { status: 404 });
      await prisma.classOccurrenceAttendance.upsert({
        where: { occurrenceId_studentId: { occurrenceId: id, studentId: input.studentId } },
        create: { occurrenceId: id, studentId: input.studentId, response: input.response === "GOING" ? "GOING" : null, respondedAt: input.response === "GOING" ? new Date() : null, actualAttendance: input.actualAttendance as typeof actualValues[number], checkedInAt: new Date() },
        update: { actualAttendance: input.actualAttendance as typeof actualValues[number], checkedInAt: new Date() },
      });
      return Response.json({ message: "Asistencia real actualizada." });
    }
    if (input.action === "remove-response") {
      if (typeof input.studentId !== "string") return Response.json({ error: "El alumno no es válido." }, { status: 400 });
      await prisma.classOccurrenceAttendance.updateMany({ where: { occurrenceId: id, studentId: input.studentId }, data: { response: null, respondedAt: null } });
      return Response.json({ message: "Confirmación quitada." });
    }
    if (input.action === "strength-block") {
      const block = input.block as { name?: unknown; notes?: unknown; exercises?: unknown };
      if (!block || typeof block.name !== "string" || !block.name.trim() || !Array.isArray(block.exercises)) return Response.json({ error: "El bloque de fuerza no es válido." }, { status: 400 });
      const blockName = block.name.trim();
      const blockNotes = typeof block.notes === "string" ? block.notes.trim() : "";
      const blockExercises = block.exercises;
      await prisma.$transaction(async (transaction) => {
        const saved = await transaction.classStrengthBlock.upsert({
          where: { occurrenceId: id },
          create: { occurrenceId: id, name: blockName, notes: blockNotes },
          update: { name: blockName, notes: blockNotes },
        });
        await transaction.classStrengthExercise.deleteMany({ where: { strengthBlockId: saved.id } });
        await transaction.classStrengthExercise.createMany({
          data: blockExercises.map((raw, index) => {
            const exercise = raw as Record<string, unknown>;
            const name = typeof exercise.exerciseName === "string" ? exercise.exerciseName.trim() : "";
            const sets = Number(exercise.suggestedSets);
            if (!name || !Number.isInteger(sets) || sets < 1) throw new Error("INVALID_BLOCK");
            return { strengthBlockId: saved.id, exerciseName: name, order: index + 1, suggestedSets: sets, suggestedReps: typeof exercise.suggestedReps === "string" ? exercise.suggestedReps.trim() : "", instructions: typeof exercise.instructions === "string" ? exercise.instructions.trim() : "" };
          }),
        });
        await transaction.classOccurrence.update({ where: { id }, data: { strengthEnabled: true } });
      });
      return Response.json({ message: "Bloque de fuerza guardado y habilitado." });
    }
    const status = typeof input.status === "string" && statusValues.includes(input.status as typeof statusValues[number]) ? input.status as typeof statusValues[number] : undefined;
    const startTime = typeof input.startTime === "string" && /^\d{2}:\d{2}$/.test(input.startTime) ? input.startTime : undefined;
    const endTime = typeof input.endTime === "string" && /^\d{2}:\d{2}$/.test(input.endTime) ? input.endTime : undefined;
    const capacity = input.capacity === null ? null : input.capacity === undefined ? undefined : Number(input.capacity);
    if (capacity !== undefined && capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return Response.json({ error: "El cupo no es válido." }, { status: 400 });
    await prisma.classOccurrence.update({
      where: { id },
      data: {
        status,
        startTime,
        endTime,
        capacityOverride: capacity,
        internalNotes: typeof input.internalNotes === "string" ? input.internalNotes.trim().slice(0, 2000) : undefined,
        strengthEnabled: typeof input.strengthEnabled === "boolean" ? input.strengthEnabled : undefined,
      },
    });
    return Response.json({ message: status === "CANCELLED" ? "Clase cancelada." : status === "COMPLETED" ? "Clase cerrada." : "Clase actualizada." });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BLOCK") return Response.json({ error: "Revisá los ejercicios del bloque de fuerza." }, { status: 400 });
    console.error("No se pudo actualizar la clase concreta", error);
    return Response.json({ error: "No se pudo actualizar la clase." }, { status: 500 });
  }
}
