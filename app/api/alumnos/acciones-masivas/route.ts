import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { getStudentPlanOptions, parseStudentInput, serializeStudent, studentInclude, studentJsonData } from "@/lib/student-enrollment";
import { isStudentServiceType } from "@/lib/student-service";
import { isDateKey } from "@/lib/payment-dates";
import { recordStudentHistoryChange } from "@/lib/student-history";
import { resolveStudentPaymentReminders } from "@/lib/payment-reminder-state";
import { loadTrainerStudentCapacity, TrainerStudentLimitError } from "@/lib/trainer-plan-limits-server";
import { countActiveManagedStudents } from "@/lib/trainer-plan-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class BulkStudentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type BulkRequest = {
  ids?: string[];
  planSelectionKey?: string;
  serviceType?: string;
  dueDate?: string;
  confirmFinancial?: boolean;
  confirmOverwrite?: boolean;
};

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const body = await request.json() as BulkRequest;
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
      return Response.json({ error: "Seleccioná entre 1 y 50 alumnos distintos." }, { status: 400 });
    }
    if (typeof body.planSelectionKey !== "string" || !body.planSelectionKey) return Response.json({ error: "Seleccioná un plan configurado." }, { status: 400 });
    if (body.serviceType && !isStudentServiceType(body.serviceType)) return Response.json({ error: "El servicio seleccionado no es válido." }, { status: 400 });
    if (body.dueDate && !isDateKey(body.dueDate)) return Response.json({ error: "Ingresá un vencimiento válido." }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const [plans, selected, allRecords, capacity] = await Promise.all([
        getStudentPlanOptions(tx, workspaceId),
        tx.studentRecord.findMany({ where: { workspaceId, id: { in: ids }, AND: [coachedStudentsWhere] }, include: studentInclude }),
        tx.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere] }, select: { id: true, data: true } }),
        loadTrainerStudentCapacity(workspaceId, tx),
      ]);
      if (selected.length !== ids.length) throw new BulkStudentError("Uno o más alumnos no pertenecen a tu espacio. Actualizá la lista.", 404);
      const plan = plans.find((item) => item.selectionKey === body.planSelectionKey);
      if (!plan) throw new BulkStudentError("El plan seleccionado ya no está disponible. Actualizá los planes.", 409);
      if (plan.price > 0 && body.confirmFinancial !== true) throw new BulkStudentError("Confirmá la cuota del plan antes de aplicar los cambios.", 409);
      if (selected.some((record) => {
        const current = serializeStudent(record);
        return (Boolean(current.plan || current.planId) && (current.planId !== plan.persistentId || current.plan !== plan.name)) ||
          Boolean(body.serviceType && body.serviceType !== current.serviceType) ||
          Boolean(body.dueDate && current.dueDate && body.dueDate !== current.dueDate);
      }) && body.confirmOverwrite !== true) throw new BulkStudentError("Confirmá el reemplazo del plan, servicio o vencimiento actual.", 409);

      const selectedById = new Map(selected.map((record) => [record.id, record]));
      const nextRecords = allRecords.map((record) => selectedById.has(record.id)
        ? { data: { ...(record.data as Prisma.JsonObject), status: "activo", lifecycleStatus: "activo", quickEnrollmentPending: false } }
        : record);
      const nextActive = countActiveManagedStudents(nextRecords);
      const nextPending = nextRecords.filter((record) => (record.data as Prisma.JsonObject).quickEnrollmentPending === true).length;
      const currentPending = allRecords.filter((record) => (record.data as Prisma.JsonObject).quickEnrollmentPending === true).length;
      if (capacity.limit !== null && (
        (nextActive > capacity.limit && nextActive > capacity.used) ||
        (nextActive + nextPending > capacity.limit && nextActive + nextPending > capacity.used + currentPending)
      )) {
        throw new TrainerStudentLimitError(capacity.limit);
      }

      for (const id of ids) {
        const record = selectedById.get(id)!;
        const current = serializeStudent(record);
        const parsed = parseStudentInput({
          ...current,
          plan: plan.name,
          planId: plan.persistentId,
          monthlyFee: plan.price,
          serviceType: body.serviceType || current.serviceType,
          dueDate: body.dueDate || current.dueDate,
          status: "activo",
        }, plans, !current.phone);
        if (!parsed.data) throw new BulkStudentError(`${current.firstName} ${current.lastName}: ${parsed.error}`);
        const input = parsed.data;
        await recordStudentHistoryChange(tx, id, record.data, record.serviceType, input);
        const previous = record.data as Prisma.JsonObject;
        await tx.studentRecord.update({
          where: { id, workspaceId, AND: [coachedStudentsWhere] },
          data: { serviceType: input.serviceType, data: { ...previous, ...studentJsonData(input), firstDueDate: previous.firstDueDate || input.dueDate || null, quickEnrollmentPending: false } },
        });
        await resolveStudentPaymentReminders(tx, id);
      }
      return tx.studentRecord.findMany({ where: { workspaceId, id: { in: ids }, AND: [coachedStudentsWhere] }, include: studentInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ students: updated.map(serializeStudent) });
  } catch (error) {
    if (error instanceof BulkStudentError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof TrainerStudentLimitError) return Response.json({ error: error.message, code: "TRAINER_STUDENT_LIMIT_REACHED" }, { status: 409 });
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Los cupos o datos cambiaron. Actualizá la lista e intentá nuevamente." }, { status: 409 });
    console.error("Error en acciones masivas de alumnos", error);
    return Response.json({ error: "No se pudieron actualizar los alumnos." }, { status: 500 });
  }
}
