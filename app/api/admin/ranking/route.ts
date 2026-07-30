import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
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
  const today = dateKeyToDatabase(argentinaDateKey());
  const from =
    period === "total"
      ? null
      : period === "30d"
        ? new Date(today.getTime() - 29 * 86400000)
        : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const where = {
    active: true,
    ...(from ? { occurredAt: { gte: from } } : {}),
  } as const;
  const totals = await prisma.studentPointTransaction.groupBy({
    by: ["studentId"],
    where,
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 10,
  });
  const studentIds = totals.map((item) => item.studentId);
  const [students, details] = await Promise.all([
    prisma.studentRecord.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, data: true },
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
  const detail = new Map<string, Map<string, number>>();
  for (const item of details) {
    const values = detail.get(item.studentId) ?? new Map<string, number>();
    values.set(item.eventType, item._count._all);
    detail.set(item.studentId, values);
  }
  const ranking: StudentRankingEntry[] = totals.flatMap((item) => {
    const record = students.find((student) => student.id === item.studentId);
    if (!record) return [];
    const data = record.data as unknown as Student;
    const counts = detail.get(item.studentId) ?? new Map<string, number>();
    return [
      {
        studentId: item.studentId,
        studentName: studentName(record.data),
        profileImageUrl: data.profileImageUrl ?? "",
        total: item._sum.points ?? 0,
        achievementCount:
          (counts.get("ACHIEVEMENT") ?? 0) +
          (counts.get("MILESTONE") ?? 0),
        attendanceThisMonth: counts.get("ATTENDANCE") ?? 0,
        recordCount: counts.get("RECORD") ?? 0,
      },
    ];
  });
  return Response.json({ period, ranking });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const students = await prisma.studentRecord.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let processed = 0;
  for (const student of students) {
    await syncStudentPoints(student.id, { notify: false });
    processed += 1;
  }
  return Response.json({
    processed,
    message: `Ranking recalculado para ${processed} alumnos.`,
  });
}
