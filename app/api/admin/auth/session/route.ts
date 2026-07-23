import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";

export async function GET() {
  const result = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!result.ok) {
    const failure = adminAuthError(result);
    return Response.json({ authenticated: false, error: failure.error }, { status: failure.status });
  }
  return Response.json({ authenticated: true, role: result.role, expiresAt: result.expiresAt.toISOString() });
}
