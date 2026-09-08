import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { onboardingData } from "@/lib/student-onboarding";
import { isSelfService, selfServicePreferences } from "@/lib/self-service";
import { StudentOnboarding } from "@/componentes/student-onboarding";
import type { Student } from "@/types/gestion";

export default async function SelfServiceProfilePage() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) redirect("/portal/login");
  const student = session.credential.student.data as unknown as Student;
  if (!isSelfService(student)) redirect("/portal");
  return <StudentOnboarding selfService initial={{ ...onboardingData(student), ...selfServicePreferences(student) }} />;
}
