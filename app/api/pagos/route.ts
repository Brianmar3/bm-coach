import { prisma } from "@/lib/prisma";
import { Prisma, StudentPaymentStatus } from "@prisma/client";
import type { Payment, PaymentStatus, Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentInput = Omit<Payment, "id" | "student" | "createdAt">;
type PaymentWithStudent = Prisma.StudentPaymentGetPayload<{ include: { student: true } }>;

function effectiveStatus(status: StudentPaymentStatus, dueDate: Date): PaymentStatus {
  if (status === "PAGADO") return "pagado";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "vencido";
  if (days <= 7) return "proximo_a_vencer";
  return "pendiente";
}

function serialize(record: PaymentWithStudent): Payment {
  const student = record.student.data as unknown as Student;
  return { id: record.id, studentId: record.studentId, student: `${student.firstName} ${student.lastName}`.trim(), amount: Number(record.amount), concept: record.concept, dueDate: record.dueDate.toISOString().slice(0, 10), paidDate: record.paidDate?.toISOString().slice(0, 10) ?? "", method: record.method, status: effectiveStatus(record.status, record.dueDate), notes: record.notes, createdAt: record.createdAt.toISOString() };
}

function validate(input: PaymentInput) {
  if (!input.studentId || !input.concept?.trim() || !input.dueDate || !input.method?.trim()) return "Completá alumno, concepto, vencimiento y método de pago.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "El importe debe ser mayor que cero.";
  if (input.status === "pagado" && !input.paidDate) return "Indicá la fecha de pago.";
  return null;
}

function dbStatus(status: PaymentStatus): StudentPaymentStatus {
  return { pagado: "PAGADO", pendiente: "PENDIENTE", vencido: "VENCIDO", proximo_a_vencer: "PROXIMO_A_VENCER" }[status] as StudentPaymentStatus;
}

export async function GET() {
  try {
    const records = await prisma.studentPayment.findMany({ include: { student: true }, orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }] });
    return Response.json(records.map(serialize));
  } catch (error) {
    console.error("Error al consultar pagos", error);
    return Response.json({ error: "No se pudieron cargar los pagos desde Neon." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as PaymentInput;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const student = await prisma.studentRecord.findUnique({ where: { id: input.studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "El alumno seleccionado ya no existe." }, { status: 404 });
    const record = await prisma.studentPayment.create({ data: { studentId: input.studentId, amount: input.amount, concept: input.concept.trim(), dueDate: new Date(`${input.dueDate}T12:00:00.000Z`), paidDate: input.paidDate ? new Date(`${input.paidDate}T12:00:00.000Z`) : null, method: input.method.trim(), status: dbStatus(input.status), notes: input.notes?.trim() ?? "" }, include: { student: true } });
    return Response.json(serialize(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear pago", error);
    return Response.json({ error: "No se pudo guardar el pago en Neon." }, { status: 500 });
  }
}
