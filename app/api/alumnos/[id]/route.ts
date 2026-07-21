import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Student, StudentStatus } from "@/types/gestion";

type StudentInput = Omit<Student, "id">;

function serialize(record: { id: string; data: Prisma.JsonValue }): Student {
  return { ...(record.data as Omit<Student, "id">), id: record.id };
}

function validate(input: StudentInput): string | null {
  if (!input.firstName?.trim() || !input.lastName?.trim() || !input.phone?.trim()) return "Nombre, apellido y teléfono son obligatorios.";
  if (!input.plan?.trim() || !input.joinedAt || !input.dueDate) return "Plan, fecha de ingreso y vencimiento son obligatorios.";
  if (!Number.isFinite(input.monthlyFee) || input.monthlyFee < 0) return "El importe mensual no es válido.";
  if (!(["activo", "inactivo"] satisfies StudentStatus[]).includes(input.status)) return "El estado no es válido.";
  return null;
}

export async function GET(_request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.studentRecord.findUnique({ where: { id } });
    if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json(serialize(record));
  } catch (error) {
    console.error("Error al consultar alumno", error);
    return Response.json({ error: "No se pudo cargar el alumno." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/alumnos/[id]">) {
  try {
    const { id } = await context.params;
    const input = await request.json() as StudentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const record = await prisma.studentRecord.update({
      where: { id },
      data: { data: input as Prisma.InputJsonValue },
    });
    return Response.json(serialize(record));
  } catch (error) {
    console.error("Error al actualizar alumno", error);
    return Response.json({ error: "No se pudo actualizar el alumno." }, { status: 500 });
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
    return Response.json({ error: "No se pudo eliminar el alumno." }, { status: 500 });
  }
}
