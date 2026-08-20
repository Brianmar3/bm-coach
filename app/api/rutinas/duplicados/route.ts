import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { databaseUnavailable } from "@/lib/rutinas";
import { loadRoutineDuplicateGroups } from "@/lib/routine-duplicate-audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class SafeDeletionConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeDeletionConflict";
  }
}

export async function GET() {
  try {
    const unauthorized = await requireAdminApiResponse();
    if (unauthorized) return unauthorized;
    return Response.json({ groups: await loadRoutineDuplicateGroups(prisma) });
  } catch (error) {
    console.error("Error al revisar posibles rutinas duplicadas", error);
    return Response.json({ error: databaseUnavailable(error) ? "La base de datos no está disponible temporalmente." : "No se pudieron revisar los posibles duplicados." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const unauthorized = await requireAdminApiResponse();
    if (unauthorized) return unauthorized;
    const body = await request.json().catch(() => null) as { routineIds?: unknown } | null;
    const routineIds = Array.isArray(body?.routineIds) ? [...new Set(body.routineIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()))] : [];
    if (!routineIds.length || routineIds.length > 20) return Response.json({ error: "Seleccioná entre 1 y 20 rutinas del mismo grupo." }, { status: 400 });

    const deletedIds = await prisma.$transaction(async (transaction) => {
      const initialGroups = await loadRoutineDuplicateGroups(transaction);
      const initialGroup = initialGroups.find((group) => routineIds.every((id) => group.routines.some((routine) => routine.id === id)));
      if (!initialGroup) throw new SafeDeletionConflict("La selección ya no forma parte de un mismo grupo de posibles duplicados.");

      for (const id of [...initialGroup.routines.map((routine) => routine.id)].sort()) {
        await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "training_routines" WHERE "id" = ${id} FOR UPDATE`);
      }

      const currentGroups = await loadRoutineDuplicateGroups(transaction);
      const currentGroup = currentGroups.find((group) => routineIds.every((id) => group.routines.some((routine) => routine.id === id)));
      if (!currentGroup) throw new SafeDeletionConflict("Los datos cambiaron durante la revisión. Volvé a revisar el grupo.");
      const selected = routineIds.map((id) => currentGroup.routines.find((routine) => routine.id === id));
      if (selected.some((routine) => !routine)) throw new SafeDeletionConflict("Una de las rutinas ya no existe.");
      const unsafe = selected.find((routine) => !routine?.safeToDelete);
      if (unsafe) throw new SafeDeletionConflict(`Esta rutina ahora tiene información asociada y ya no puede eliminarse de forma segura. ${unsafe.riskReasons.join(" ")}`);
      if (currentGroup.routines.length - routineIds.length < 1) throw new SafeDeletionConflict("Debe conservarse al menos una rutina del grupo.");

      const result = await transaction.trainingRoutine.deleteMany({ where: { id: { in: routineIds } } });
      if (result.count !== routineIds.length) throw new SafeDeletionConflict("Una de las rutinas cambió o dejó de existir.");
      return routineIds;
    });

    return Response.json({ deletedIds, message: `${deletedIds.length} rutina${deletedIds.length === 1 ? "" : "s"} vacía${deletedIds.length === 1 ? "" : "s"} eliminada${deletedIds.length === 1 ? "" : "s"} de forma segura.` });
  } catch (error) {
    if (error instanceof SafeDeletionConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2034"].includes(error.code)) return Response.json({ error: "Los datos cambiaron durante la operación. No se eliminó ninguna rutina; volvé a revisar el grupo." }, { status: 409 });
    console.error("Error al eliminar rutinas duplicadas seguras", error);
    return Response.json({ error: databaseUnavailable(error) ? "La base de datos no está disponible temporalmente." : "No se pudieron eliminar las rutinas seleccionadas." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}
