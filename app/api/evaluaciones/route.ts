import { Prisma } from "@prisma/client";
import { databaseUnavailable, evaluationData, serializeEvaluation, validateEvaluation, type EvaluationInput } from "@/lib/evaluaciones";
import { prisma } from "@/lib/prisma";
import { notifyNewAchievements } from "@/lib/push-notifications";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";

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

    const record = await prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.physicalEvaluation.findFirst({
        where: { studentId: input.studentId, date: evaluationData(input).date },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_EVALUATION");
      return transaction.physicalEvaluation.create({ data: evaluationData(input), include: { student: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await notifyNewAchievements(record.studentId);
    await reconcileStudentPointsAfterMutation(record.studentId);
    return Response.json(serializeEvaluation(record), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_EVALUATION") return Response.json({ error: "Ya existe una evaluación para ese alumno en esa fecha." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La evaluación cambió mientras la guardabas. Intentá nuevamente." }, { status: 409 });
    console.error("Error al crear evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar la evaluación en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
