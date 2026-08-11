import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";
import { PAYMENT_METHODS, paymentDashboard, serializePayment, storedStudent } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentInput = {
  studentId: string;
  amount: number;
  paidDate: string;
  billingPeriod: string;
  method: string;
  nextDueDate: string;
  notes?: string;
  requestKey?: string;
};

function validate(input: PaymentInput) {
  if (!input.studentId?.trim() || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 100_000_000) {
    return "Ingresá un alumno y un importe mayor que cero.";
  }
  if (!isDateKey(input.paidDate)) return "Ingresá una fecha de pago válida.";
  if (!isDateKey(input.billingPeriod) || !input.billingPeriod.endsWith("-01")) return "Seleccioná un período válido.";
  if (!PAYMENT_METHODS.includes(input.method as (typeof PAYMENT_METHODS)[number])) return "Seleccioná un medio de pago válido.";
  if (!isDateKey(input.nextDueDate)) return "Ingresá un próximo vencimiento válido.";
  if (input.nextDueDate < input.paidDate) return "El próximo vencimiento no puede ser anterior a la fecha de pago.";
  if ((input.notes?.length ?? 0) > 1000) return "La nota es demasiado extensa.";
  if (input.requestKey && input.requestKey.length > 100) return "La identificación de la solicitud no es válida.";
  return null;
}

export async function GET(request: Request) {
  try {
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
    if (!studentId) return Response.json(await paymentDashboard());
    const student = await prisma.studentRecord.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    const payments = await prisma.studentPayment.findMany({
      where: { studentId },
      include: { student: true },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(payments.map(serializePayment));
  } catch (error) {
    console.error("Error al consultar pagos", error);
    return Response.json({ error: "No se pudo cargar la información de pagos desde Neon." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as PaymentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      if (input.requestKey) {
        const prior = await transaction.studentPayment.findUnique({ where: { requestKey: input.requestKey }, include: { student: true } });
        if (prior) {
          if (prior.studentId !== input.studentId) throw new Error("INVALID_REQUEST_KEY");
          return { payment: prior, duplicate: true };
        }
      }
      const record = await transaction.studentRecord.findUnique({ where: { id: input.studentId } });
      if (!record) throw new Error("STUDENT_NOT_FOUND");
      const student = storedStudent(record.data);
      if (student.status === "inactivo") throw new Error("STUDENT_INACTIVE");

      const paidDate = dateKeyToDatabase(input.paidDate);
      const billingPeriod = dateKeyToDatabase(input.billingPeriod);
      const duplicate = await transaction.studentPayment.findFirst({
        where: {
          studentId: input.studentId,
          status: "PAGADO",
          paidDate,
          billingPeriod,
          amount: input.amount,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_PAYMENT");

      const payment = await transaction.studentPayment.create({
        data: {
          studentId: input.studentId,
          amount: input.amount,
          concept: `Cuota mensual · ${student.plan || "Plan"}`,
          billingPeriod,
          dueDate: dateKeyToDatabase(student.dueDate || input.paidDate),
          nextDueDateSnapshot: dateKeyToDatabase(input.nextDueDate),
          paidDate,
          method: input.method,
          status: "PAGADO",
          notes: input.notes?.trim() ?? "",
          requestKey: input.requestKey?.trim() || null,
        },
        include: { student: true },
      });
      await transaction.studentRecord.update({
        where: { id: input.studentId },
        data: { data: { ...(student as unknown as Prisma.InputJsonObject), dueDate: input.nextDueDate } },
      });
      return { payment, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return Response.json(
      { payment: serializePayment(result.payment), dashboard: await paymentDashboard(), duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "STUDENT_NOT_FOUND") return Response.json({ error: "El alumno seleccionado ya no existe." }, { status: 404 });
    if (message === "STUDENT_INACTIVE") return Response.json({ error: "El alumno ya no está activo." }, { status: 409 });
    if (message === "DUPLICATE_PAYMENT") return Response.json({ error: "Ese pago ya fue registrado para el alumno, fecha y período seleccionados." }, { status: 409 });
    if (message === "INVALID_REQUEST_KEY") return Response.json({ error: "La solicitud de pago no corresponde al alumno seleccionado." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return Response.json({ error: "El estado de pagos cambió mientras guardabas. Recargá e intentá nuevamente." }, { status: 409 });
    }
    console.error("Error al registrar pago", error);
    return Response.json({ error: "No se pudo guardar el pago en Neon." }, { status: 500 });
  }
}
