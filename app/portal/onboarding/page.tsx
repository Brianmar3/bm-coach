import { redirect } from "next/navigation";
import { StudentOnboarding } from "@/componentes/student-onboarding";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { onboardingData, onboardingIsComplete } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";

export default async function OnboardingPage() {
  const session = await requirePortalPageSession();
  if (session.credential.mustChangePassword) redirect("/portal");
  const student = session.credential.student.data as unknown as Student;
  if (onboardingIsComplete(student)) redirect("/portal");
  return <StudentOnboarding initial={onboardingData(student)} />;
}
