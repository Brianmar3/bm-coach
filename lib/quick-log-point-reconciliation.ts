import "server-only";
import { prisma } from "@/lib/prisma";
import { isPointEligibleQuickLog } from "@/lib/quick-log-point-rules";

/** Source IDs and student IDs identify the original records; descriptions are never used. */
export async function reconcileInformativeQuickLogPoints(studentIds: string[]) {
  if (!studentIds.length) return;
  const logs = await prisma.quickLog.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true, studentId: true, type: true, metricType: true, exerciseName: true, durationMinutes: true, sets: true, repetitions: true, currentValue: true, previousValue: true },
  });
  const invalid = logs.filter(log => !isPointEligibleQuickLog({ ...log, currentValue: log.currentValue === null ? null : Number(log.currentValue), previousValue: log.previousValue === null ? null : Number(log.previousValue) }));
  if (!invalid.length) return;
  await prisma.studentPointTransaction.updateMany({
    where: {
      active: true, sourceType: "QUICK_LOG",
      OR: invalid.map(log => ({ studentId: log.studentId, sourceId: log.id, eventKey: `record:quick-log:${log.id}` })),
    },
    data: { active: false, invalidatedAt: new Date() },
  });
}
