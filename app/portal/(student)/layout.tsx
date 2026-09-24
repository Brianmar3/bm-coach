import { studentProfilePhoto } from "@/lib/student-media";
import type { ReactNode } from "react";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { PortalShell } from "@/componentes/portal-shell";
import { hasActivePortalRoutine } from "@/lib/portal-service-access";
import { establishAchievementBaseline } from "@/lib/push-notifications";
import type { Student } from "@/types/gestion";
import { redirect } from "next/navigation";
import { onboardingIsComplete } from "@/lib/student-onboarding";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  if (!session.credential.mustChangePassword && !onboardingIsComplete(student)) redirect("/portal/onboarding");
  const [hasRoutine, , branding] = await Promise.all([
    session.credential.student.workspaceId
      ? hasActivePortalRoutine(session.studentId, session.credential.student.workspaceId)
      : Promise.resolve(false),
    establishAchievementBaseline(session.studentId),
    loadWorkspaceBranding(session.credential.student.workspaceId),
  ]);
  return <PortalShell branding={branding} studentName={`${student.firstName} ${student.lastName}`.trim()} profileImageUrl={studentProfilePhoto(session.studentId, student.profileImageUrl)} serviceType={session.credential.student.serviceType} hasRoutine={hasRoutine}>{children}</PortalShell>;
}
