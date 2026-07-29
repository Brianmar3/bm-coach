import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { hasGroupClasses } from "@/lib/student-service";

export async function requirePortalClassAccess() {
  const session = await requirePortalPageSession();
  if (!hasGroupClasses(session.credential.student.serviceType)) redirect("/portal");
  return session;
}

export async function requirePortalRoutineAccess() {
  const session = await requirePortalPageSession();
  if (session.credential.student.serviceType !== "CLASSES") return session;
  const hasRoutine = await prisma.trainingRoutineAssignment.count({
    where: {
      studentId: session.studentId,
      active: true,
      routine: { status: "ACTIVA" },
    },
  });
  if (!hasRoutine) redirect("/portal");
  return session;
}
