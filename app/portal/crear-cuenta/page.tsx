import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { PortalRegistrationForm } from "@/componentes/portal-registration-form";

export default async function RegistrationPage() {
  if (await getPortalSession({ allowSelfService: true })) redirect("/portal");
  return <PortalRegistrationForm />;
}
