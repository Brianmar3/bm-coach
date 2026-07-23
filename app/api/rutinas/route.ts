import { databaseUnavailable, nestedDays, routineData, routineInclude, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const studentId = params.get("studentId")?.trim();
    const objective = params.get("objective")?.trim();
    const query = params.get("q")?.trim();
    const status = params.get("status")?.trim();
    const records = await prisma.trainingRoutine.findMany({
      where: {
        ...(studentId ? { assignments: { some: { studentId } } } : {}),
        ...(objective ? { objective } : {}),
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { objective: { contains: query, mode: "insensitive" } }] } : {}),
        ...(status === "ACTIVA" || status === "ARCHIVADA" ? { status } : {}),
      },
      include: routineInclude,
      orderBy: { createdAt: "desc" },
    });
    return Response.json(records.map(serializeRoutine));
  } catch (error) {
    console.error("Error al consultar rutinas", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar las rutinas desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as RoutineInput;
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const students = await prisma.studentRecord.count({ where: { id: { in: input.studentIds } } });
    if (students !== input.studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      if (input.status === "activa") {
        const conflicts = await transaction.trainingRoutineAssignment.count({ where: { studentId: { in: input.studentIds }, active: true, routine: { status: "ACTIVA" } } });
        if (conflicts) throw new Error("ACTIVE_ASSIGNMENT_CONFLICT");
      }
      return transaction.trainingRoutine.create({
        data: {
          ...routineData(input),
          days: { create: nestedDays(input.days) },
          assignments: { create: input.studentIds.map((studentId) => ({ studentId, active: input.status === "activa", archivedAt: input.status === "archivada" ? new Date() : null })) },
        },
        include: routineInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json(serializeRoutine(record), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_ASSIGNMENT_CONFLICT") return Response.json({ error: "Uno o más alumnos ya tienen una rutina activa asignada." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Las asignaciones cambiaron al mismo tiempo. Recargá e intentá nuevamente." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Error Prisma al crear rutina", { code: error.code, message: error.message, meta: error.meta });
    else console.error("Error al crear rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar la rutina en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
