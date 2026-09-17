import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { authorizedTrainerWorkspace, assertSameWorkspace, assertWritableWorkspaceContent } from "@/lib/workspace-access";

/** The current shared secret authenticates ONLY the legacy owner, never another coach. */
export async function requireTrainerWorkspace() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) throw new Error("Autenticación administrativa requerida.");
  const memberships = await prisma.workspaceMembership.findMany({
    where: auth.userId ? { userId: auth.userId } : { role: "OWNER", workspace: { slug: "bm-fuerza-funcional" } },
    include: { user: true, workspace: true },
  });
  if (!auth.userId && memberships.length !== 1) throw new Error("Ejecutá y verificá el backfill del owner inicial.");
  return authorizedTrainerWorkspace(auth.userId ?? memberships[0].userId, memberships);
}

export async function assertStudentInWorkspace(studentId: string, workspaceId: string) {
  const student = await prisma.studentRecord.findUnique({ where: { id: studentId, workspaceId }, select: { id: true, workspaceId: true } });
  assertSameWorkspace(workspaceId, student);
  return student!;
}

export async function assertRoutineInWorkspace(routineId: string, workspaceId: string, { allowGlobal = false } = {}) {
  const routine = await prisma.trainingRoutine.findUnique({ where: { id: routineId }, select: { id: true, workspaceId: true, scope: true } });
  if (allowGlobal && routine?.scope === "GLOBAL") return routine;
  assertWritableWorkspaceContent(workspaceId, routine);
  return routine!;
}

export async function assertScheduleInWorkspace(scheduleId: string, workspaceId: string) {
  const schedule = await prisma.weeklyClassSchedule.findUnique({ where: { id: scheduleId, workspaceId }, select: { id: true, workspaceId: true } });
  assertSameWorkspace(workspaceId, schedule);
  return schedule!;
}

export async function assertOccurrenceInWorkspace(occurrenceId: string, workspaceId: string) {
  const occurrence = await prisma.classOccurrence.findUnique({ where: { id: occurrenceId, workspaceId }, select: { id: true, workspaceId: true } });
  assertSameWorkspace(workspaceId, occurrence);
  return occurrence!;
}
