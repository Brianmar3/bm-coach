import "server-only";
import type { Prisma } from "@prisma/client";
import { databaseDateKey } from "@/lib/payment-dates";

// Resolve only these commercial reminders; retain the record and its event key.
export async function resolveStudentPaymentReminders(db: Prisma.TransactionClient, studentId: string) {
  const notices = await db.studentNotification.findMany({ where: { studentId, readAt: null, OR: [
    { eventKey: { startsWith: "payment-reminder:" } }, { eventKey: { startsWith: "service-expiration:" } },
  ] }, select: { id: true, eventKey: true, message: true } });
  if (!notices.length) return;
  const [student, obligations, payments] = await Promise.all([
    db.studentRecord.findUnique({ where: { id: studentId }, select: { data: true } }),
    db.monthlyStudentObligation.findMany({ where: { studentId } }),
    db.studentPayment.groupBy({ by: ["billingPeriod"], where: { studentId, status: "PAGADO" }, _sum: { amount: true } }),
  ]);
  const profile = student?.data as { dueDate?: string; status?: string } | undefined;
  const paid = new Map(payments.map(item => [item.billingPeriod ? databaseDateKey(item.billingPeriod) : "", Number(item._sum.amount ?? 0)]));
  const matchingService = profile?.dueDate ? await hasMatchingPaymentObligation(db, studentId, profile.dueDate) : false;
  const resolved = notices.filter(notice => {
    const key = notice.eventKey ?? "";
    if (key.startsWith("service-expiration:")) {
      const match = key.match(/:(\d{4}-\d{2}-\d{2}):(THREE_DAYS|DUE_TODAY)$/);
      return !profile || profile.status !== "activo" || profile.dueDate !== match?.[1] || matchingService;
    }
    const obligation = obligations.find(item => key.startsWith(`payment-reminder:${item.id}:`));
    if (!obligation) return false; // A missing association is not proof of payment.
    const storedDate = key.match(/:(\d{4}-\d{2}-\d{2}):/);
    return profile?.status === "inactivo" || obligation.status === "VOID" ||
      (paid.get(databaseDateKey(obligation.period)) ?? 0) >= Number(obligation.expectedAmount) ||
      Boolean(storedDate && storedDate[1] !== databaseDateKey(obligation.dueDate));
  });
  await Promise.all(resolved.map(notice => db.studentNotification.updateMany({ where: { studentId, id: { in: [notice.id] }, readAt: null },
    data: { readAt: new Date(), title: "Recordatorio resuelto", message: `Aviso histórico: ya no requiere acción. ${notice.message}` },
  })));
}

// The profile has no explicit obligation ID. Suppress only an unambiguous match
// in this student's monthly ledger, never unrelated obligations or dates.
export async function hasMatchingPaymentObligation(db: Prisma.TransactionClient, studentId: string, dueDate: string) {
  const student = await db.studentRecord.findUnique({ where: { id: studentId }, select: { data: true, serviceType: true, workspaceId: true } });
  const profile = student?.data as { plan?: string; dueDate?: string } | undefined;
  if (!student?.workspaceId || !profile?.plan || profile.dueDate !== dueDate) return false;
  return await db.monthlyStudentObligation.count({ where: { studentId, student: { workspaceId: student.workspaceId },
    dueDate: new Date(dueDate + "T00:00:00Z"), status: { not: "VOID" }, planNameSnapshot: profile.plan, serviceSnapshot: student.serviceType,
  } }) === 1;
}
