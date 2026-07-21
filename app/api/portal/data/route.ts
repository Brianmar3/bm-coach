import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";
import { serializeEvaluation } from "@/lib/evaluaciones";
import { serializeEvent } from "@/lib/eventos";
import type { Payment, PaymentStatus, Student } from "@/types/gestion";
import type { PortalData } from "@/types/portal";
import type { Prisma, StudentPaymentStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function serializePayment(record: PaymentWithStudent): Payment {
  const student = record.student.data as unknown as Student;
  return { id: record.id, studentId: record.studentId, student: `${student.firstName} ${student.lastName}`.trim(), amount: Number(record.amount), concept: record.concept, dueDate: record.dueDate.toISOString().slice(0, 10), paidDate: record.paidDate?.toISOString().slice(0, 10) ?? "", method: record.method, status: effectiveStatus(record.status, record.dueDate), notes: record.notes, createdAt: record.createdAt.toISOString() };
}

export async function GET() {
  try {
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    const studentId = session.studentId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [routine, evaluations, payments, events] = await Promise.all([
      prisma.trainingRoutine.findFirst({ where: { status: "ACTIVA", assignments: { some: { studentId } } }, include: routineInclude, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: { studentId }, include: { student: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      prisma.studentPayment.findMany({ where: { studentId }, include: { student: true }, orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }] }),
      prisma.coachEvent.findMany({ where: { status: "PENDIENTE", date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8 }),
    ]);
    const student = session.credential.student.data as unknown as Student;
    const privateRoutine = routine ? { ...serializeRoutine(routine), studentIds: [studentId], students: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }] } : null;
    const data: PortalData = {
      profile: { id: studentId, firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: student.email, birthDate: student.birthDate, goal: student.goal, plan: student.plan, joinedAt: student.joinedAt, status: student.status },
      routine: privateRoutine,
      evaluations: evaluations.map(serializeEvaluation),
      payments: payments.map(serializePayment),
      events: events.map(serializeEvent),
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al cargar datos del portal", error);
    return Response.json({ error: "No se pudo cargar tu información desde Neon." }, { status: 500 });
  }
}
