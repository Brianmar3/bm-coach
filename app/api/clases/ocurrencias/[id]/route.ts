import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";

export const runtime = "nodejs";

const statusValues = ["SCHEDULED", "CANCELLED", "COMPLETED"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { id } = await context.params;
    const input = await request.json() as Record<string, unknown>;
    const occurrence = await prisma.classOccurrence.findUnique({
      where: { id },
      select: {
        id: true,
        responses: { select: { studentId: true } },
      },
    });
    if (!occurrence) return Response.json({ error: "La clase no existe." }, { status: 404 });
    if (input.action === "attendance") {
      return Response.json(
        {
          error:
            "La asistencia real se registra únicamente desde la pantalla Asistencias.",
        },
        { status: 410 },
      );
    }
    if (input.action === "remove-response") {
      if (typeof input.studentId !== "string") return Response.json({ error: "El alumno no es válido." }, { status: 400 });
      await prisma.classOccurrenceAttendance.updateMany({ where: { occurrenceId: id, studentId: input.studentId }, data: { response: null, respondedAt: null } });
      return Response.json({ message: "Confirmación quitada." });
    }
    if (input.action === "strength-block") {
      return Response.json(
        { error: "El registro de ejercicios dentro de clases ya no está disponible. Usá Registro rápido." },
        { status: 410 },
      );
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
      },
    });
    if (status === "CANCELLED") {
      await Promise.all(
        occurrence.responses.map((item) =>
          reconcileStudentPointsAfterMutation(item.studentId),
        ),
      );
    }
    return Response.json({ message: status === "CANCELLED" ? "Clase cancelada." : status === "COMPLETED" ? "Clase cerrada." : "Clase actualizada." });
  } catch (error) {
    console.error("No se pudo actualizar la clase concreta", error);
    return Response.json({ error: "No se pudo actualizar la clase." }, { status: 500 });
  }
}
