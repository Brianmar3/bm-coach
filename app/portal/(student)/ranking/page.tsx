import { PortalRanking } from "@/componentes/portal-ranking";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isCompetitiveGamificationEligible } from "@/lib/student-service";

export default async function PortalRankingPage() {
  const session = await getPortalSession();
  if (!session || !isCompetitiveGamificationEligible(session.credential.student.serviceType)) redirect("/portal/progreso");
  return <PortalRanking />;
}
