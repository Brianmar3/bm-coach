import { redirect } from "next/navigation";
import { StudentOnboarding } from "@/componentes/student-onboarding";
import { getPortalSession } from "@/lib/portal-auth";
import { isSelfService, selfServicePreferences } from "@/lib/self-service";
import { onboardingData, onboardingIsComplete } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";
import { DEFAULT_WORKSPACE_BRANDING } from "@/lib/workspace-branding";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export default async function OnboardingPage() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) redirect("/portal/login");
  if (session.credential.mustChangePassword) redirect("/portal");
  const student = session.credential.student.data as unknown as Student;
  const selfService = isSelfService(student);
  if (onboardingIsComplete(student)) redirect(selfService ? "/portal/autogestion" : "/portal");
  const branding = selfService ? DEFAULT_WORKSPACE_BRANDING : await loadWorkspaceBranding(session.credential.student.workspaceId);
  return <StudentOnboarding branding={branding} selfService={selfService} initial={{ ...onboardingData(student), ...(selfService ? selfServicePreferences(student) : {}) }} />;
}
