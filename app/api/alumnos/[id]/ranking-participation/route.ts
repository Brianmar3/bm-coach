import { Prisma } from "@prisma/client";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export async function PATCH(request: Request, context: RouteContext<"/api/alumnos/[id]/ranking-participation">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });

  const trainer = await requireTrainerWorkspace().catch(() => null);
  if (!trainer) return Response.json({ error: "Acceso no autorizado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const rankingParticipation = body?.rankingParticipation;
  if (typeof rankingParticipation !== "boolean") {
    return Response.json({ error: "Preferencia inválida." }, { status: 400 });
  }

  const { id } = await context.params;
  const where = { id, workspaceId: trainer.workspaceId, AND: [coachedStudentsWhere] };
  try {
    const found = await prisma.$transaction(async (transaction) => {
      const student = await transaction.studentRecord.findUnique({ where, select: { data: true } });
      if (!student) return false;
      await transaction.studentRecord.update({
        where,
        data: { data: { ...(student.data as Prisma.JsonObject), rankingParticipation } },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!found) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    return Response.json({ rankingParticipation });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return Response.json({ error: "La ficha cambió mientras guardabas. Volvé a intentarlo." }, { status: 409 });
    }
    return Response.json({ error: "No se pudo guardar la preferencia." }, { status: 500 });
  }
}
