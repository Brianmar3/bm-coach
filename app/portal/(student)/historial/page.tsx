import { PortalSection } from "@/componentes/portal-section";
import { requirePortalRoutineAccess } from "@/lib/portal-service-access";

export default async function PortalHistoryPage() {
  await requirePortalRoutineAccess();
  return <PortalSection section="historial" />;
}
