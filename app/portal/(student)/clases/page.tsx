import { PortalClasses } from "@/componentes/portal-classes";
import { requirePortalClassAccess } from "@/lib/portal-service-access";

export default async function PortalClassesPage() {
  await requirePortalClassAccess();
  return <PortalClasses />;
}
