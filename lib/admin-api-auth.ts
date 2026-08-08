import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";

export async function requireAdminApiResponse() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (auth.ok) return null;
  const failure = adminAuthError(auth);
  return Response.json({ error: failure.error }, { status: failure.status });
}
