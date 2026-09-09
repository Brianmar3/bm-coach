import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { PortalRegistrationForm } from "@/componentes/portal-registration-form";
import { SELF_SERVICE_SIGNUP_ENABLED } from "@/lib/self-service-signup";

export default async function RegistrationPage() {
  if (!SELF_SERVICE_SIGNUP_ENABLED) redirect("/portal/login");
  if (await getPortalSession({ allowSelfService: true })) redirect("/portal");
  return <PortalRegistrationForm />;
}
