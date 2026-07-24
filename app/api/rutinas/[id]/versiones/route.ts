import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]/versiones">) {
  try {
    const { id } = await context.params;
    const routine = await prisma.trainingRoutine.findUnique({ where: { id }, select: { id: true } });
    if (!routine) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    const versions = await prisma.trainingRoutineVersion.findMany({
      where: { routineId: id },
      select: { id: true, version: true, summary: true, createdAt: true },
      orderBy: { version: "desc" },
    });
    return Response.json(versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() })));
  } catch (error) {
    console.error("Error al cargar versiones de rutina", error);
    return Response.json({ error: "No se pudo cargar el historial de versiones." }, { status: 500 });
  }
}
