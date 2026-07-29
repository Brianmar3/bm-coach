import "server-only";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { hasGroupClasses } from "@/lib/student-service";

export function activePortalRoutineWhere(studentId: string) {
  return {
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

export async function hasActivePortalRoutine(studentId: string) {
  return await prisma.trainingRoutine.count({
    where: activePortalRoutineWhere(studentId),
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
  if (!await hasActivePortalRoutine(session.studentId)) redirect("/portal");
  return session;
}
