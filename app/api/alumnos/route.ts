import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Student, StudentStatus } from "@/types/gestion";

export const runtime = "nodejs";

type StudentInput = Omit<Student, "id">;

function serialize(record: { id: string; data: Prisma.JsonValue }): Student {
  return { ...(record.data as Omit<Student, "id">), id: record.id };
}

function validate(input: StudentInput): string | null {
  if (!input.firstName?.trim() || !input.lastName?.trim() || !input.phone?.trim()) {
    return "Nombre, apellido y teléfono son obligatorios.";
  }
  if (!input.plan?.trim() || !input.joinedAt || !input.dueDate) {
    return "Plan, fecha de ingreso y vencimiento son obligatorios.";
  }
  if (!Number.isFinite(input.monthlyFee) || input.monthlyFee < 0) {
    return "El importe mensual no es válido.";
  }
  if (!(["activo", "inactivo"] satisfies StudentStatus[]).includes(input.status)) {
    return "El estado no es válido.";
  }
  return null;
}

function isConnectionError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

async function createStudent(input: StudentInput) {
  const data = { id: randomUUID(), data: input as Prisma.InputJsonValue };
  try {
    return await prisma.studentRecord.create({ data });
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 750));
    await prisma.$connect();
    return prisma.studentRecord.create({ data });
  }
}

export async function GET() {
  try {
    const records = await prisma.studentRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return Response.json(records.map(serialize));
  } catch (error) {
    console.error("Error al consultar alumnos", error);
    return Response.json({ error: "No se pudieron cargar los alumnos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as StudentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const record = await createStudent(input);
    return Response.json(serialize(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear alumno", error);
    if (isConnectionError(error)) {
      return Response.json({ error: "La base de datos no está disponible temporalmente. Intentá nuevamente." }, { status: 503 });
    }
    return Response.json({ error: "No se pudo guardar el alumno." }, { status: 500 });
  }
}
