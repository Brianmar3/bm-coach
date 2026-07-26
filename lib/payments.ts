import { Prisma, type StudentPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  argentinaDateKey,
  argentinaMonthBounds,
  databaseDateKey,
  dateKeyToDatabase,
  paymentAccountStatus,
} from "@/lib/payment-dates";
import type { Payment, PaymentDashboard, PaymentStatus, PaymentStudentAccount, Student } from "@/types/gestion";

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Mercado Pago", "Otro"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

const accountOrder = { VENCIDA: 0, VENCE_PRONTO: 1, AL_DIA: 2, SIN_CONFIGURAR: 3 } as const;

export function storedStudent(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentPhone(student: Student) {
  return (student.studentType === "Kids" ? student.responsiblePhone || student.phone : student.phone || student.responsiblePhone) ?? "";
}

export function paymentStatus(status: StudentPaymentStatus): PaymentStatus {
  return {
    PAGADO: "pagado",
    PENDIENTE: "pendiente",
    VENCIDO: "vencido",
    PROXIMO_A_VENCER: "proximo_a_vencer",
    ANULADO: "anulado",
  }[status] as PaymentStatus;
}

type PaymentWithStudent = Prisma.StudentPaymentGetPayload<{ include: { student: true } }>;

export function serializePayment(record: PaymentWithStudent): Payment {
  const student = storedStudent(record.student.data);
  return {
    id: record.id,
    studentId: record.studentId,
    student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
    amount: Number(record.amount),
    concept: record.concept,
    billingPeriod: record.billingPeriod ? databaseDateKey(record.billingPeriod) : "",
    dueDate: databaseDateKey(record.dueDate),
    paidDate: record.paidDate ? databaseDateKey(record.paidDate) : "",
    method: record.method,
    status: paymentStatus(record.status),
    notes: record.notes,
    voidedAt: record.voidedAt?.toISOString() ?? "",
    voidReason: record.voidReason ?? "",
    createdAt: record.createdAt.toISOString(),
  };
}

export async function paymentDashboard(): Promise<PaymentDashboard> {
  const asOf = argentinaDateKey();
  const { monthStart, nextMonthStart } = argentinaMonthBounds(asOf);
  const start = dateKeyToDatabase(monthStart);
  const end = dateKeyToDatabase(nextMonthStart);
  const [records, monthAggregate] = await Promise.all([
    prisma.studentRecord.findMany({
      include: { payments: { orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }] } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studentPayment.aggregate({
      where: { status: "PAGADO", paidDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const students: PaymentStudentAccount[] = records
    .map((record) => ({ record, student: storedStudent(record.data) }))
    .filter(({ student }) => student.status !== "inactivo")
    .map(({ record, student }) => {
      const validPayments = record.payments.filter((payment) => payment.status === "PAGADO" && payment.paidDate);
      const lastPayment = validPayments[0];
      const status = paymentAccountStatus(student.dueDate ?? "", asOf);
      return {
        studentId: record.id,
        student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
        plan: student.plan ?? "",
        monthlyFee: Number(student.monthlyFee ?? 0),
        phone: studentPhone(student),
        paymentCount: validPayments.length,
        paidThisMonth: validPayments.some((payment) => payment.paidDate && payment.paidDate >= start && payment.paidDate < end),
        lastPaymentDate: lastPayment?.paidDate ? databaseDateKey(lastPayment.paidDate) : "",
        lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : null,
        nextDueDate: student.dueDate ?? "",
        status,
      };
    })
    .sort((left, right) =>
      accountOrder[left.status] - accountOrder[right.status]
      || (left.nextDueDate || "9999-12-31").localeCompare(right.nextDueDate || "9999-12-31")
      || left.student.localeCompare(right.student, "es"),
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
      estimatedOutstanding: students
        .filter((student) => student.status === "VENCIDA" || student.status === "VENCE_PRONTO")
        .reduce((sum, student) => sum + Math.max(student.monthlyFee, 0), 0),
    },
  };
}
