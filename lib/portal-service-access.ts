import "server-only";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { hasGroupClasses, hasPersonalizedService } from "@/lib/student-service";

export function activePortalRoutineWhere(studentId: string, workspaceId: string) {
  return {
    workspaceId,
    scope: "WORKSPACE",
    kind: "ASSIGNED",
    status: "ACTIVA",
    archivedAt: null,
    days: {
      some: {
        active: true,
        archivedAt: null,
        exercises: { some: { active: true, archivedAt: null } },
      },
    },
    assignments: {
      some: {
        studentId,
        active: true,
        archivedAt: null,
      },
    },
  } satisfies Prisma.TrainingRoutineWhereInput;
}

export async function hasActivePortalRoutine(studentId: string, workspaceId: string) {
  return await prisma.trainingRoutine.count({
    where: activePortalRoutineWhere(studentId, workspaceId),
  }) > 0;
}

export async function requirePortalClassAccess() {
  const session = await requirePortalPageSession();
  if (!hasGroupClasses(session.credential.student.serviceType)) redirect("/portal");
  return session;
}

export async function requirePortalRoutineAccess() {
  const session = await requirePortalPageSession();
  if (session.credential.student.serviceType !== "CLASSES") return session;
  if (!session.credential.student.workspaceId || !await hasActivePortalRoutine(session.studentId, session.credential.student.workspaceId)) redirect("/portal");
  return session;
}

export async function requirePortalProgressAccess() {
  const session = await requirePortalPageSession();
  if (!hasPersonalizedService(session.credential.student.serviceType)) redirect("/portal/rutina");
  if (!session.credential.student.workspaceId || !await hasActivePortalRoutine(session.studentId, session.credential.student.workspaceId)) redirect("/portal/rutina");
  return session;
}
