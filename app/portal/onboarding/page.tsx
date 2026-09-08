import { redirect } from "next/navigation";
import { StudentOnboarding } from "@/componentes/student-onboarding";
import { getPortalSession } from "@/lib/portal-auth";
import { isSelfService, selfServicePreferences } from "@/lib/self-service";
import { onboardingData, onboardingIsComplete } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";

export default async function OnboardingPage() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) redirect("/portal/login");
  if (session.credential.mustChangePassword) redirect("/portal");
  const student = session.credential.student.data as unknown as Student;
  const selfService = isSelfService(student);
  if (onboardingIsComplete(student)) redirect(selfService ? "/portal/autogestion" : "/portal");
  return <StudentOnboarding selfService={selfService} initial={{ ...onboardingData(student), ...(selfService ? selfServicePreferences(student) : {}) }} />;
}
