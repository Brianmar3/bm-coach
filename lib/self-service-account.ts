import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isSelfService } from "@/lib/self-service";
import { onboardingIsComplete } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";

export async function requireSelfServiceAccount() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) redirect("/portal/login");
  const student = session.credential.student.data as unknown as Student;
  if (!isSelfService(student)) redirect("/portal");
  if (!onboardingIsComplete(student)) redirect("/portal/onboarding");
  return { student, studentId: session.studentId };
}
