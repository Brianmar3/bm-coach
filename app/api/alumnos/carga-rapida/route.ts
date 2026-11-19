import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { loadTrainerStudentCapacity, TrainerStudentLimitError } from "@/lib/trainer-plan-limits-server";
import { quickStudentBatchFits, quickStudentIssue, type QuickStudentRow } from "@/lib/quick-student-enrollment";
import { serializeStudent, studentInclude, studentJsonData, type ParsedStudentInput } from "@/lib/student-enrollment";
import { recordInitialStudentHistory } from "@/lib/student-history";
import { argentinaDateKey } from "@/lib/payment-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class QuickEnrollmentError extends Error {}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const body = await request.json() as { rows?: QuickStudentRow[] };
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 50) return Response.json({ error: "Seleccioná entre 1 y 50 alumnos." }, { status: 400 });
    if (body.rows.some((row) => !row || typeof row.firstName !== "string" || typeof row.lastName !== "string" || typeof row.phone !== "string")) return Response.json({ error: "Revisá los datos de los alumnos." }, { status: 400 });
    const rows = body.rows.map((row) => ({ firstName: String(row?.firstName ?? "").trim(), lastName: String(row?.lastName ?? "").trim(), phone: String(row?.phone ?? "").trim() }));
    if (rows.some((row) => row.firstName.length > 120 || row.lastName.length > 120)) return Response.json({ error: "El nombre o apellido es demasiado largo." }, { status: 400 });
    const created = await prisma.$transaction(async (tx) => {
      const existingRecords = await tx.studentRecord.findMany({ where: { workspaceId }, select: { data: true } });
      const capacity = await loadTrainerStudentCapacity(workspaceId, tx);
      const pending = existingRecords.filter((record) => (record.data as Record<string, unknown>).quickEnrollmentPending === true).length;
      if (!quickStudentBatchFits(capacity.limit, capacity.used, pending, rows.length)) throw new TrainerStudentLimitError(capacity.limit!);
      const existing = existingRecords.map((record) => record.data as unknown as QuickStudentRow);
      const accepted: QuickStudentRow[] = [];
      for (const row of rows) {
        const issue = quickStudentIssue(row, existing, accepted);
        if (issue) throw new QuickEnrollmentError(`${row.firstName} ${row.lastName}: ${issue}`);
        accepted.push(row);
      }
      const today = argentinaDateKey();
      const ids: string[] = [];
      for (const row of rows) {
        const input = {
          ...row, email: "", birthDate: "", weight: 0, height: 0, goal: "", plan: "", planId: "", monthlyFee: 0,
          joinedAt: today, dueDate: "", status: "inactivo", serviceType: "CLASSES", notes: "", studentType: "Adulto",
          responsibleName: "", responsiblePhone: "", responsibleRelation: "", scheduleId: "", scheduleIds: [], flexibleSchedule: "",
        } as ParsedStudentInput;
        const id = randomUUID();
        await tx.studentRecord.create({ data: { id, workspaceId, phoneNormalized: row.phone.replace(/\D/g, "") || null, serviceType: input.serviceType, data: { ...studentJsonData(input), firstDueDate: null, quickEnrollmentPending: true } } });
        await recordInitialStudentHistory(tx, id, input);
        ids.push(id);
      }
      return tx.studentRecord.findMany({ where: { workspaceId, id: { in: ids } }, include: studentInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ students: created.map(serializeStudent) }, { status: 201 });
  } catch (error) {
    if (error instanceof TrainerStudentLimitError) return Response.json({ error: error.message, code: "TRAINER_STUDENT_LIMIT_REACHED" }, { status: 409 });
    if (error instanceof QuickEnrollmentError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return Response.json({ error: "Los alumnos cambiaron mientras guardabas. Revisá la lista e intentá nuevamente." }, { status: 409 });
    console.error("Error en carga rápida de alumnos", error);
    return Response.json({ error: "No se pudieron guardar los alumnos." }, { status: 500 });
  }
}
