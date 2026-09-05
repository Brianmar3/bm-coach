import { redirect } from "next/navigation";
import { requirePortalPageSession } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";
import { StudentOnboarding } from "@/componentes/student-onboarding";

export default async function OnboardingPage() {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  if (student.onboardingCompleted) redirect("/portal");
  return <StudentOnboarding />;
}
