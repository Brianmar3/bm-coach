import { PortalSection } from "@/componentes/portal-section";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isCompetitiveGamificationEligible } from "@/lib/student-service";

export default async function PortalPointsHistoryPage() {
  const session = await getPortalSession();
  if (!session || !isCompetitiveGamificationEligible(session.credential.student.serviceType)) redirect("/portal/puntos");
  return <PortalSection section="puntos-historial" />;
}
