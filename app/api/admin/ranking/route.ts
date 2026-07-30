import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { argentinaDateKey, argentinaDateTimeBoundary, argentinaMonthBounds } from "@/lib/payment-dates";
import { validRequestOrigin } from "@/lib/portal-auth";
import { syncStudentPoints } from "@/lib/student-points";
import type { Student } from "@/types/gestion";
import type { StudentRankingEntry } from "@/types/points";

async function authorize() {
  const auth = verifyAdminSessionValue(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
  );
  return auth.ok ? null : adminAuthError(auth);
}

export async function GET(request: Request) {
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const period = new URL(request.url).searchParams.get("period") ?? "month";
  const todayKey = argentinaDateKey();
  const { monthStart: argentinaMonthStart } = argentinaMonthBounds(todayKey);
  const from =
    period === "total"
      ? null
      : period === "30d"
        ? new Date(argentinaDateTimeBoundary(todayKey).getTime() - 29 * 86400000)
        : argentinaDateTimeBoundary(argentinaMonthStart);
  const monthStart = argentinaDateTimeBoundary(argentinaMonthStart);
  const periodWhere = {
    active: true,
    ...(from ? { occurredAt: { gte: from } } : {}),
  } as const;
  const allStudents = await prisma.studentRecord.findMany({
    select: { id: true, data: true },
    orderBy: { createdAt: "asc" },
  });
  const students = allStudents.filter((record) => {
    const data = record.data as unknown as Student;
    return data.status !== "inactivo";
  });
  const studentIds = students.map((student) => student.id);
  const [totals, historicalTotals, details] = await Promise.all([
    prisma.studentPointTransaction.groupBy({
      by: ["studentId"],
      where: { ...periodWhere, studentId: { in: studentIds } },
      _sum: { points: true },
    }),
    prisma.studentPointTransaction.groupBy({
      by: ["studentId"],
      where: { active: true, studentId: { in: studentIds } },
      _sum: { points: true },
    }),
    prisma.studentPointTransaction.groupBy({
      by: ["studentId", "eventType"],
      where: {
        active: true,
        studentId: { in: studentIds },
        OR: [
          { eventType: { in: ["ACHIEVEMENT", "MILESTONE"] } },
          { eventType: "RECORD" },
          { eventType: "ATTENDANCE", occurredAt: { gte: monthStart } },
        ],
      },
      _count: { _all: true },
    }),
  ]);
  const totalByStudent = new Map(totals.map((item) => [item.studentId, item._sum.points ?? 0]));
  const historicalByStudent = new Map(historicalTotals.map((item) => [item.studentId, item._sum.points ?? 0]));
  const detail = new Map<string, Map<string, number>>();
  for (const item of details) {
    const values = detail.get(item.studentId) ?? new Map<string, number>();
    values.set(item.eventType, item._count._all);
    detail.set(item.studentId, values);
  }
  const ranking: StudentRankingEntry[] = students.map((record) => {
    const data = record.data as unknown as Student;
    const counts = detail.get(record.id) ?? new Map<string, number>();
    const historicalTotal = historicalByStudent.get(record.id) ?? 0;
    return {
      studentId: record.id,
      studentName: studentName(record.data),
      profileImageUrl: data.profileImageUrl ?? "",
      total: totalByStudent.get(record.id) ?? 0,
      historicalTotal,
      level: historicalTotal >= 500 ? "Hito" : historicalTotal >= 250 ? "Progreso" : historicalTotal >= 100 ? "Constancia" : "Inicio",
      serviceType: data.serviceType ?? "CLASSES",
      achievementCount: (counts.get("ACHIEVEMENT") ?? 0) + (counts.get("MILESTONE") ?? 0),
      attendanceThisMonth: counts.get("ATTENDANCE") ?? 0,
      recordCount: counts.get("RECORD") ?? 0,
    };
  }).sort((left, right) =>
    right.total - left.total ||
    right.historicalTotal - left.historicalTotal ||
    left.studentName.localeCompare(right.studentName, "es"),
  );
  return Response.json({ period, ranking, activeStudentCount: ranking.length });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const records = await prisma.studentRecord.findMany({
    select: { id: true, data: true },
    orderBy: { createdAt: "asc" },
  });
  const students = records.filter((record) => (record.data as unknown as Student).status !== "inactivo");
  let processed = 0;
  let eventsCreated = 0;
  let eventsOmitted = 0;
  let quickLogsProcessed = 0;
  let classExercisesProcessed = 0;
  let attendancesProcessed = 0;
  let studentsWithoutActivity = 0;
  const errors: Array<{ studentId: string; studentName: string; error: string }> = [];
  for (const student of students) {
    try {
      const result = await syncStudentPoints(student.id, { notify: false });
      processed += 1;
      eventsCreated += result.gained.length;
      eventsOmitted += Math.max(0, result.desiredCount - result.gained.length);
      quickLogsProcessed += result.sourceCounts.quickLogs;
      classExercisesProcessed += result.sourceCounts.classExercises;
      attendancesProcessed += result.sourceCounts.attendances;
      if (result.activityEventCount === 0) studentsWithoutActivity += 1;
    } catch (error) {
      errors.push({
        studentId: student.id,
        studentName: studentName(student.data),
        error: error instanceof Error ? error.message.slice(0, 180) : "Error desconocido",
      });
    }
  }
  return Response.json({
    processed,
    totalActiveStudents: students.length,
    eventsCreated,
    eventsOmitted,
    quickLogsProcessed,
    classExercisesProcessed,
    attendancesProcessed,
    studentsWithoutActivity,
    errors,
    message: `Ranking recalculado: ${processed} de ${students.length} alumnos activos procesados.`,
  });
}
