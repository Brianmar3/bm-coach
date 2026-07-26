import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseDateKey, dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";
import { PAYMENT_METHODS, paymentDashboard, serializePayment, storedStudent } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EditPaymentInput = {
  amount: number;
  paidDate: string;
  billingPeriod: string;
  method: string;
  notes?: string;
};

function validate(input: EditPaymentInput) {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 100_000_000) return "El importe debe ser mayor que cero.";
  if (!isDateKey(input.paidDate)) return "Ingresá una fecha de pago válida.";
  if (!isDateKey(input.billingPeriod) || !input.billingPeriod.endsWith("-01")) return "Seleccioná un período válido.";
  if (!PAYMENT_METHODS.includes(input.method as (typeof PAYMENT_METHODS)[number])) return "Seleccioná un medio de pago válido.";
  if ((input.notes?.length ?? 0) > 1000) return "La nota es demasiado extensa.";
  return null;
}

export async function GET(_request: Request, context: RouteContext<"/api/pagos/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.studentPayment.findUnique({ where: { id }, include: { student: true } });
    if (!record) return Response.json({ error: "Pago no encontrado." }, { status: 404 });
    return Response.json(serializePayment(record));
  } catch (error) {
    console.error("Error al consultar pago", error);
    return Response.json({ error: "No se pudo cargar el pago desde Neon." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/pagos/[id]">) {
  try {
    const { id } = await context.params;
    const input = await request.json() as EditPaymentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const record = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.studentPayment.findUnique({ where: { id }, include: { student: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status === "ANULADO") throw new Error("VOIDED");
      const duplicate = await transaction.studentPayment.findFirst({
        where: {
          id: { not: id },
          studentId: existing.studentId,
          status: "PAGADO",
          paidDate: dateKeyToDatabase(input.paidDate),
          billingPeriod: dateKeyToDatabase(input.billingPeriod),
          amount: input.amount,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_PAYMENT");
      return transaction.studentPayment.update({
        where: { id },
        data: {
          amount: input.amount,
          paidDate: dateKeyToDatabase(input.paidDate),
          billingPeriod: dateKeyToDatabase(input.billingPeriod),
          method: input.method,
          notes: input.notes?.trim() ?? "",
        },
        include: { student: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ payment: serializePayment(record), dashboard: await paymentDashboard() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return Response.json({ error: "Pago no encontrado." }, { status: 404 });
    if (message === "VOIDED") return Response.json({ error: "Un pago anulado no puede editarse." }, { status: 409 });
    if (message === "DUPLICATE_PAYMENT") return Response.json({ error: "Ya existe otro pago igual para esa fecha y período." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "El pago cambió mientras lo editabas." }, { status: 409 });
    console.error("Error al actualizar pago", error);
    return Response.json({ error: "No se pudo actualizar el pago en Neon." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/pagos/[id]">) {
  try {
    const { id } = await context.params;
    const input = await request.json() as { action?: "void"; reason?: string };
    if (input.action !== "void" || !input.reason?.trim() || input.reason.trim().length > 500) {
      return Response.json({ error: "Ingresá un motivo de anulación válido." }, { status: 400 });
    }
    const voidReason = input.reason.trim();
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.studentPayment.findUnique({ where: { id }, include: { student: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status === "ANULADO") return { record: existing, warning: null };
      let warning: string | null = null;

      const laterValidPayment = await transaction.studentPayment.findFirst({
        where: {
          id: { not: id },
          studentId: existing.studentId,
          status: "PAGADO",
          paidDate: existing.paidDate ? { gt: existing.paidDate } : undefined,
        },
        select: { id: true },
      });
      if (!laterValidPayment) {
        if (existing.nextDueDateSnapshot) {
          const student = storedStudent(existing.student.data);
          const coveredDueDate = databaseDateKey(existing.dueDate);
          const recordedNextDueDate = databaseDateKey(existing.nextDueDateSnapshot);
          if (student.dueDate === recordedNextDueDate) {
            await transaction.studentRecord.update({
              where: { id: existing.studentId },
              data: { data: { ...(student as unknown as Prisma.InputJsonObject), dueDate: coveredDueDate } },
            });
          }
        } else {
          warning = "El pago es anterior al sistema de auditoría. Se anuló correctamente, pero el próximo vencimiento no se modificó porque no existe una referencia segura. Revisalo manualmente en la ficha del alumno.";
        }
      }
      const record = await transaction.studentPayment.update({
        where: { id },
        data: { status: "ANULADO", voidedAt: new Date(), voidReason },
        include: { student: true },
      });
      return { record, warning };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ payment: serializePayment(result.record), dashboard: await paymentDashboard(), warning: result.warning });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "Pago no encontrado." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "El pago cambió mientras lo anulabas." }, { status: 409 });
    console.error("Error al anular pago", error);
    return Response.json({ error: "No se pudo anular el pago." }, { status: 500 });
  }
}

export async function DELETE() {
  return Response.json({ error: "Los pagos se anulan para conservar el historial administrativo." }, { status: 405, headers: { Allow: "GET, PUT, PATCH" } });
}
