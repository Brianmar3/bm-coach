import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { validRequestOrigin } from "@/lib/portal-auth";
import { syncStudentPoints } from "@/lib/student-points";
import type { Student } from "@/types/gestion";
import { loadPointRanking } from "@/lib/point-ranking";
import type { PointRankingPeriod } from "@/lib/point-period";

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
  const requestedPeriod = new URL(request.url).searchParams.get("period") ?? "month";
  const period: PointRankingPeriod = requestedPeriod === "30d" || requestedPeriod === "total" ? requestedPeriod : "month";
  const ranking = await loadPointRanking(period);
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
  let routineSessionsProcessed = 0;
  let attendancesProcessed = 0;
  let achievementsProcessed = 0;
  let eventsCorrected = 0;
  let individualExerciseEventsRemoved = 0;
  let studentsWithoutActivity = 0;
  const errors: Array<{ studentId: string; studentName: string; error: string }> = [];
  for (const student of students) {
    try {
      const result = await syncStudentPoints(student.id, {
        notify: false,
        cleanupHistoricalMarks: true,
      });
      processed += 1;
      eventsCreated += result.gained.length;
      eventsOmitted += Math.max(0, result.desiredCount - result.gained.length);
      quickLogsProcessed += result.sourceCounts.quickLogs;
      routineSessionsProcessed += result.sourceCounts.routineSessions;
      attendancesProcessed += result.sourceCounts.attendances;
      achievementsProcessed += result.sourceCounts.achievements;
      individualExerciseEventsRemoved += result.individualExerciseEventsRemoved;
      eventsCorrected += result.eventsInvalidated;
      if (result.activityEventCount === 0) studentsWithoutActivity += 1;
    } catch (error) {
      errors.push({
        studentId: student.id,
        studentName: studentName(student.data),
        error: error instanceof Error ? error.message.slice(0, 180) : "Error desconocido",
      });
    }
  }
  const historicalClassExercisesIgnored = await prisma.classExerciseLog.count({
    where: { workoutLog: { status: "COMPLETED" } },
  });
  return Response.json({
    processed,
    totalActiveStudents: students.length,
    eventsCreated,
    eventsOmitted,
    quickLogsProcessed,
    routineSessionsProcessed,
    attendancesProcessed,
    achievementsProcessed,
    eventsCorrected,
    individualExerciseEventsRemoved,
    historicalClassExercisesIgnored,
    studentsWithoutActivity,
    errors,
    message: `Ranking recalculado: ${processed} de ${students.length} alumnos activos procesados.`,
  });
}
