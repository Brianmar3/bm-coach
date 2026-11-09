import { PortalClasses } from "@/componentes/portal-classes";
import { requirePortalClassAccess } from "@/lib/portal-service-access";

export default async function PortalClassesPage({ searchParams }: { searchParams: Promise<{ clase?: string | string[] }> }) {
  const session = await requirePortalClassAccess();
  const { clase } = await searchParams;
  const selectedClassId = typeof clase === "string" ? clase : undefined;
  return <PortalClasses key={selectedClassId} selectedClassId={selectedClassId} showQuickLogAction={session.credential.student.serviceType === "MIXED"} />;
}
