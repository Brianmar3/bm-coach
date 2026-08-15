import { PortalProgressView } from "@/componentes/portal-progress";
import { requirePortalProgressAccess } from "@/lib/portal-service-access";

export default async function PortalProgressPage() {
  await requirePortalProgressAccess();
  return <PortalProgressView />;
}
