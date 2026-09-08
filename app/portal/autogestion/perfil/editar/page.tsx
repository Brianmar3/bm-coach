import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { onboardingData } from "@/lib/student-onboarding";
import { selfServicePreferences } from "@/lib/self-service";
import { StudentOnboarding } from "@/componentes/student-onboarding";
export default async function EditSelfServiceProfilePage() {
  const { student } = await requireSelfServiceAccount();
  return <StudentOnboarding selfService initial={{ ...onboardingData(student), ...selfServicePreferences(student) }} />;
}
