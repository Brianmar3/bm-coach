import { databaseUnavailable, nestedDays, routineData, routineInclude, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const studentId = params.get("studentId")?.trim();
    const objective = params.get("objective")?.trim();
    const query = params.get("q")?.trim();
    const records = await prisma.trainingRoutine.findMany({
      where: {
        ...(studentId ? { assignments: { some: { studentId } } } : {}),
        ...(objective ? { objective } : {}),
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { objective: { contains: query, mode: "insensitive" } }] } : {}),
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

    const record = await prisma.trainingRoutine.create({
      data: {
        ...routineData(input),
        days: { create: nestedDays(input.days) },
        assignments: { create: input.studentIds.map((studentId) => ({ studentId })) },
      },
      include: routineInclude,
    });
    return Response.json(serializeRoutine(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar la rutina en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
