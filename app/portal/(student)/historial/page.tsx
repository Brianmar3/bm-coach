import { redirect } from "next/navigation";
import { requirePortalRoutineAccess } from "@/lib/portal-service-access";

export default async function PortalHistoryPage() {
  await requirePortalRoutineAccess();
  redirect("/portal/rutina#historial-entrenamientos");
}
