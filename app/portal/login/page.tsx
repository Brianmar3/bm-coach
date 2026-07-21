import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { PortalLoginForm } from "@/componentes/portal-login-form";

export default async function PortalLoginPage() {
  if (await getPortalSession()) redirect("/portal");
  return <PortalLoginForm />;
}
