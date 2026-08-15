import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActivePainReport } from "@/lib/routine-follow-up-filters";
import { expectedRoutineSessions, followUpSummary, routineCompliance, routineFollowUpState } from "@/lib/routine-follow-up-metrics";
import type { Student } from "@/types/gestion";
import type { AdminStudentFollowUp, AdminWorkoutSession } from "@/types/follow-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentName(data: Prisma.JsonValue) {
  const value = data as unknown as Student;
  return `${value.firstName ?? ""} ${value.lastName ?? ""}`.trim() || "Alumno";
}

export async function GET() {
  try {
    const assignments = await prisma.trainingRoutineAssignment.findMany({
      where: { active: true, routine: { kind: "ASSIGNED", status: "ACTIVA" } },
      include: { student: true, routine: { include: { days: { where: { active: true }, select: { id: true } } } } },
      orderBy: { assignedAt: "desc" },
    });
    const assignedByStudent = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) if (!assignedByStudent.has(assignment.studentId)) assignedByStudent.set(assignment.studentId, assignment);
    const studentIds = [...assignedByStudent.keys()];
    const sessions = studentIds.length ? await prisma.workoutSession.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        id: true, studentId: true, routineId: true, routineNameSnapshot: true, routineDayNumberSnapshot: true,
        date: true, durationMinutes: true, status: true, hasPain: true, painDetails: true, updatedAt: true,
        exercises: { select: { id: true, sets: { select: { completed: true } } } },
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    }) : [];
    const recentLimit = new Date(); recentLimit.setDate(recentLimit.getDate() - 28);
    const students: AdminStudentFollowUp[] = studentIds.map((id) => {
      const assignment = assignedByStudent.get(id)!;
      const profile = assignment.student.data as unknown as Student;
      const own = sessions.filter((session) => session.studentId === id);
      const completed = own.filter((session) => session.status === "COMPLETED");
      const latest = own[0] ?? null;
      const durations = completed.flatMap((session) => session.durationMinutes === null ? [] : [session.durationMinutes]);
      const latestPain = own.filter((session) => session.hasPain).sort((left, right) => right.date.getTime() - left.date.getTime())[0];
      const latestPainReport = latestPain && isActivePainReport(latestPain.date)
        ? { date: latestPain.date.toISOString().slice(0, 10), details: latestPain.painDetails || "Sin detalle informado." }
        : null;
      const expectedSessionCount = expectedRoutineSessions({
        assignedAt: assignment.assignedAt, startDate: assignment.routine.startDate,
        durationWeeks: assignment.routine.durationWeeks, plannedDays: assignment.routine.days.length,
      });
      const state = routineFollowUpState({ completedSessions: completed.length, expectedSessions: expectedSessionCount, hasActivePain: Boolean(latestPainReport) });
      const latestSession: AdminWorkoutSession | null = latest ? {
        id: latest.id, studentId: id, studentName: studentName(assignment.student.data), routineId: latest.routineId ?? "",
        routine: latest.routineNameSnapshot || assignment.routine.name, dayNumber: latest.routineDayNumberSnapshot,
        date: latest.date.toISOString().slice(0, 10), startTime: "", durationMinutes: latest.durationMinutes,
        status: latest.status.toLowerCase() as AdminWorkoutSession["status"], energyBefore: null, difficulty: null, energyAfter: null,
        finalComment: "", hasPain: latest.hasPain, painDetails: latest.painDetails, updatedAt: latest.updatedAt.toISOString(),
        exerciseCount: latest.exercises.length, completedSets: latest.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0),
        pendingComments: 0, exercises: [],
      } : null;
      return {
        studentId: id, studentName: studentName(assignment.student.data), profileImageUrl: profile.profileImageUrl ?? "",
        activeRoutine: {
          id: assignment.routine.id, name: assignment.routine.name, location: assignment.routine.location,
          status: assignment.routine.status.toLowerCase(), startDate: assignment.routine.startDate?.toISOString().slice(0, 10) ?? "",
          assignedAt: assignment.assignedAt.toISOString(), durationWeeks: assignment.routine.durationWeeks, plannedDays: assignment.routine.days.length,
        },
        latestSession, sessionCount: completed.length,
        averageDuration: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        exerciseCount: completed.reduce((sum, session) => sum + session.exercises.length, 0),
        completedSets: completed.reduce((sum, session) => sum + session.exercises.reduce((subtotal, exercise) => subtotal + exercise.sets.filter((set) => set.completed).length, 0), 0),
        recentSessionCount: completed.filter((session) => session.date >= recentLimit).length,
        latestPainReport, recentProgress: "", hasClassStrength: false, expectedSessionCount,
        compliancePercentage: routineCompliance(completed.length, expectedSessionCount), ...state,
      };
    }).sort((left, right) => (right.latestSession?.date ?? "").localeCompare(left.latestSession?.date ?? "") || left.studentName.localeCompare(right.studentName, "es"));

    return Response.json({ students, summary: followUpSummary(students) });
  } catch (error) {
    console.error("Error al cargar el resumen de seguimiento", error);
    return Response.json({ error: "No se pudo cargar el seguimiento." }, { status: 500 });
  }
}
