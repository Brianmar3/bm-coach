import type { ReactNode } from "react";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { PortalShell } from "@/componentes/portal-shell";
import { hasActivePortalRoutine } from "@/lib/portal-service-access";
import { establishAchievementBaseline } from "@/lib/push-notifications";
import type { Student } from "@/types/gestion";
import { redirect } from "next/navigation";
import { onboardingIsComplete } from "@/lib/student-onboarding";
import { loadWorkspaceAccentColor } from "@/lib/workspace-branding-server";

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  if (!session.credential.mustChangePassword && !onboardingIsComplete(student)) redirect("/portal/onboarding");
  const [hasRoutine, , accentColor] = await Promise.all([
    session.credential.student.workspaceId
      ? hasActivePortalRoutine(session.studentId, session.credential.student.workspaceId)
      : Promise.resolve(false),
    establishAchievementBaseline(session.studentId),
    loadWorkspaceAccentColor(session.credential.student.workspaceId),
  ]);
  return <PortalShell accentColor={accentColor} studentName={`${student.firstName} ${student.lastName}`.trim()} profileImageUrl={student.profileImageUrl ?? ""} serviceType={session.credential.student.serviceType} hasRoutine={hasRoutine}>{children}</PortalShell>;
}
