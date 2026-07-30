import { StudentNutrition } from "@/componentes/student-nutrition";
import { requirePortalPageSession } from "@/lib/portal-auth";

export default async function PortalNutritionPage() {
  await requirePortalPageSession();
  return <StudentNutrition />;
}
