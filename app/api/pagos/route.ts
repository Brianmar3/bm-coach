import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  argentinaDateKey,
  argentinaMonthBounds,
  databaseDateKey,
  dateKeyToDatabase,
  isDateKey,
  nextPaymentDueDate,
  paymentAccountStatus,
} from "@/lib/payment-dates";
import type { Payment, PaymentDashboard, PaymentStudentAccount, Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentInput = {
  studentId: string;
  amount: number;
  paidDate: string;
  method: string;
  dueDate?: string;
  notes?: string;
};

const accountOrder = { VENCIDA: 0, VENCE_PRONTO: 1, AL_DIA: 2, SIN_CONFIGURAR: 3 } as const;

function storedStudent(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentPhone(student: Student) {
  return (student.studentType === "Kids" ? student.responsiblePhone || student.phone : student.phone || student.responsiblePhone) ?? "";
}

async function dashboard(): Promise<PaymentDashboard> {
  const asOf = argentinaDateKey();
  const { monthStart, nextMonthStart } = argentinaMonthBounds(asOf);
  const [records, monthAggregate] = await Promise.all([
    prisma.studentRecord.findMany({
      include: { payments: { orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }] } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studentPayment.aggregate({
      where: {
        status: "PAGADO",
        paidDate: { gte: dateKeyToDatabase(monthStart), lt: dateKeyToDatabase(nextMonthStart) },
      },
      _sum: { amount: true },
    }),
  ]);

  const students: PaymentStudentAccount[] = records
    .map((record) => ({ record, student: storedStudent(record.data) }))
    .filter(({ student }) => student.status !== "inactivo")
    .map(({ record, student }) => {
      const lastPayment = record.payments.find((payment) => payment.status === "PAGADO" && payment.paidDate);
      const status = paymentAccountStatus(student.dueDate ?? "", asOf);
      return {
        studentId: record.id,
        student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
        plan: student.plan ?? "",
        monthlyFee: Number(student.monthlyFee ?? 0),
        phone: studentPhone(student),
        lastPaymentDate: lastPayment?.paidDate ? databaseDateKey(lastPayment.paidDate) : "",
        lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : null,
        nextDueDate: student.dueDate ?? "",
        status,
      };
    })
    .sort((left, right) =>
      accountOrder[left.status] - accountOrder[right.status] ||
      (left.nextDueDate || "9999-12-31").localeCompare(right.nextDueDate || "9999-12-31") ||
      left.student.localeCompare(right.student, "es"),
    );

  const count = (status: PaymentStudentAccount["status"]) => students.filter((student) => student.status === status).length;
  return {
    asOf,
    students,
    summary: {
      collectedThisMonth: Number(monthAggregate._sum.amount ?? 0),
      overdueCount: count("VENCIDA"),
      dueSoonCount: count("VENCE_PRONTO"),
      currentCount: count("AL_DIA"),
      unconfiguredCount: count("SIN_CONFIGURAR"),
      estimatedOutstanding: students.filter((student) => student.status === "VENCIDA").reduce((sum, student) => sum + student.monthlyFee, 0),
    },
  };
}

function serializePayment(record: Prisma.StudentPaymentGetPayload<{ include: { student: true } }>): Payment {
  const student = storedStudent(record.student.data);
  return {
    id: record.id,
    studentId: record.studentId,
    student: `${student.firstName} ${student.lastName}`.trim(),
    amount: Number(record.amount),
    concept: record.concept,
    dueDate: databaseDateKey(record.dueDate),
    paidDate: record.paidDate ? databaseDateKey(record.paidDate) : "",
    method: record.method,
    status: "pagado",
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}

function validate(input: PaymentInput) {
  if (!input.studentId || !Number.isFinite(input.amount) || input.amount <= 0) return "Ingresá un alumno y un importe mayor que cero.";
  if (!isDateKey(input.paidDate)) return "Ingresá una fecha de pago válida.";
  if (!input.method?.trim()) return "Seleccioná un medio de pago.";
  if (input.dueDate && !isDateKey(input.dueDate)) return "Ingresá un próximo vencimiento válido.";
  return null;
}

export async function GET() {
  try {
    return Response.json(await dashboard());
  } catch (error) {
    console.error("Error al consultar el panel de pagos", error);
    return Response.json({ error: "No se pudo cargar el panel de pagos desde Neon." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as PaymentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const record = await transaction.studentRecord.findUnique({ where: { id: input.studentId } });
      if (!record) throw new Error("STUDENT_NOT_FOUND");
      const student = storedStudent(record.data);
      if (student.status === "inactivo") throw new Error("STUDENT_INACTIVE");

      const paidDate = dateKeyToDatabase(input.paidDate);
      const duplicate = await transaction.studentPayment.findFirst({
        where: { studentId: input.studentId, status: "PAGADO", paidDate },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_PAYMENT");

      const nextDueDate = input.dueDate || nextPaymentDueDate(student.dueDate ?? "", input.paidDate);
      if (!isDateKey(nextDueDate)) throw new Error("INVALID_DUE_DATE");
      const payment = await transaction.studentPayment.create({
        data: {
          studentId: input.studentId,
          amount: input.amount,
          concept: `Cuota mensual · ${student.plan || "Plan"}`,
          dueDate: dateKeyToDatabase(student.dueDate || input.paidDate),
          paidDate,
          method: input.method.trim(),
          status: "PAGADO",
          notes: input.notes?.trim() ?? "",
        },
        include: { student: true },
      });
      await transaction.studentRecord.update({
        where: { id: input.studentId },
        data: { data: { ...(student as unknown as Prisma.InputJsonObject), dueDate: nextDueDate } },
      });
      return payment;
    });

    return Response.json({ payment: serializePayment(result), dashboard: await dashboard() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "STUDENT_NOT_FOUND") return Response.json({ error: "El alumno seleccionado ya no existe." }, { status: 404 });
    if (message === "STUDENT_INACTIVE") return Response.json({ error: "El alumno ya no está activo." }, { status: 409 });
    if (message === "DUPLICATE_PAYMENT") return Response.json({ error: "Ya registraste un pago para este alumno en esa fecha." }, { status: 409 });
    if (message === "INVALID_DUE_DATE") return Response.json({ error: "No se pudo calcular el próximo vencimiento." }, { status: 400 });
    console.error("Error al registrar pago", error);
    return Response.json({ error: "No se pudo guardar el pago en Neon." }, { status: 500 });
  }
}
