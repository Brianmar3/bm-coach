import { prisma } from "@/lib/prisma";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const records = await prisma.trainingRoutine.findMany({
      where: { workspaceId, scope: "WORKSPACE", kind: "TEMPLATE", archivedAt: null },
      include: routineInclude,
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(records.map(serializeRoutine));
  } catch {
    return Response.json({ error: "No se pudo cargar la biblioteca de clases." }, { status: 500 });
  }
}
