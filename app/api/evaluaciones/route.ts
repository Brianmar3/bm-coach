import { databaseUnavailable, evaluationData, serializeEvaluation, validateEvaluation, type EvaluationInput } from "@/lib/evaluaciones";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
    const records = await prisma.physicalEvaluation.findMany({
      where: studentId ? { studentId } : undefined,
      include: { student: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(records.map(serializeEvaluation));
  } catch (error) {
    console.error("Error al consultar evaluaciones físicas", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar las evaluaciones desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as EvaluationInput;
    const validationError = validateEvaluation(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const student = await prisma.studentRecord.findUnique({ where: { id: input.studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "El alumno seleccionado no existe." }, { status: 404 });

    const record = await prisma.physicalEvaluation.create({
      data: evaluationData(input),
      include: { student: true },
    });
    return Response.json(serializeEvaluation(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar la evaluación en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
