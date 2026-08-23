import { PortalClasses } from "@/componentes/portal-classes";
import { requirePortalClassAccess } from "@/lib/portal-service-access";

export default async function PortalClassesPage() {
  const session = await requirePortalClassAccess();
  return <PortalClasses showQuickLogAction={session.credential.student.serviceType === "MIXED"} />;
}
