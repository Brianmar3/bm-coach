import { PortalSection } from "@/componentes/portal-section";
import { requirePortalRoutineAccess } from "@/lib/portal-service-access";
export default async function PortalTrainingPage() { await requirePortalRoutineAccess(); return <PortalSection section="entrenamiento" />; }
