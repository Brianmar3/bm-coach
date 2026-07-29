import type { ReactNode } from "react";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { PortalShell } from "@/componentes/portal-shell";
import { prisma } from "@/lib/prisma";
import type { Student } from "@/types/gestion";

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  const hasRoutine = await prisma.trainingRoutineAssignment.count({
    where: { studentId: session.studentId, active: true, routine: { status: "ACTIVA" } },
  }) > 0;
  return <PortalShell studentName={`${student.firstName} ${student.lastName}`.trim()} profileImageUrl={student.profileImageUrl ?? ""} serviceType={session.credential.student.serviceType} hasRoutine={hasRoutine}>{children}</PortalShell>;
}
