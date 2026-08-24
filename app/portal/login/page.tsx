import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-auth";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { choosePortalExperience, LAST_PORTAL_COOKIE, parsePortalExperience } from "@/lib/portal-experience";
import { PortalLoginForm } from "@/componentes/portal-login-form";

export default async function PortalLoginPage() {
  const cookieStore = await cookies();
  const studentSession = await getPortalSession();
  const adminSession = verifyAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const experience = choosePortalExperience({ studentValid: Boolean(studentSession), adminValid: adminSession.ok, preferred: parsePortalExperience(cookieStore.get(LAST_PORTAL_COOKIE)?.value) });
  if (experience === "student") redirect("/portal");
  if (experience === "admin") redirect("/dashboard");
  return <PortalLoginForm />;
}
