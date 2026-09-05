import type { ReactNode } from "react";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { PortalShell } from "@/componentes/portal-shell";
import { hasActivePortalRoutine } from "@/lib/portal-service-access";
import { establishAchievementBaseline } from "@/lib/push-notifications";
import type { Student } from "@/types/gestion";
import { redirect } from "next/navigation";

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  if (!student.onboardingCompleted) redirect("/portal/onboarding");
  const [hasRoutine] = await Promise.all([
    hasActivePortalRoutine(session.studentId),
    establishAchievementBaseline(session.studentId),
  ]);
  return <PortalShell studentName={`${student.firstName} ${student.lastName}`.trim()} profileImageUrl={student.profileImageUrl ?? ""} serviceType={session.credential.student.serviceType} hasRoutine={hasRoutine}>{children}</PortalShell>;
}
