import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-auth";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { choosePortalExperience, LAST_PORTAL_COOKIE, parsePortalExperience } from "@/lib/portal-experience";
import { PortalLoginForm } from "@/componentes/portal-login-form";

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const mode = (await searchParams).mode;
  const explicitStudentLogin = mode === "student";
  const cookieStore = await cookies();
  const studentSession = await getPortalSession({ allowSelfService: true });
  const adminSession = verifyAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (explicitStudentLogin) {
    if (studentSession) redirect("/portal");
    return <PortalLoginForm />;
  }
  const experience = choosePortalExperience({ studentValid: Boolean(studentSession), adminValid: adminSession.ok, preferred: parsePortalExperience(cookieStore.get(LAST_PORTAL_COOKIE)?.value) });
  if (experience === "student") redirect("/portal");
  if (experience === "admin") redirect("/dashboard");
  return <PortalLoginForm />;
}
